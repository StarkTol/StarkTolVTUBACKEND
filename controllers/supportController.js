const { supabase } = require('../config/supabase');
const { generateResponse } = require('../utils/helpers');
const { supportService } = require('../services/supportService');
const { notificationService } = require('../services/notificationService');

class SupportController {
    // Create a new support ticket
    async createTicket(req, res) {
        try {
            const userId = req.user.id;
            const { subject, message, category, priority = 'medium' } = req.body;

            // Validate input
            if (!subject || !message || !category) {
                return res.status(400).json(generateResponse(false, 'Subject, message, and category are required'));
            }

            const validCategories = ['technical', 'billing', 'vtu_services', 'account', 'general'];
            const validPriorities = ['low', 'medium', 'high', 'urgent'];

            if (!validCategories.includes(category)) {
                return res.status(400).json(generateResponse(false, 'Invalid category'));
            }

            if (!validPriorities.includes(priority)) {
                return res.status(400).json(generateResponse(false, 'Invalid priority'));
            }

            // Generate ticket number
            const ticketNumber = `TKT${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

            // Create support ticket
            const { data: ticketData, error: ticketError } = await supabase
                .from('support_tickets')
                .insert({
                    user_id: userId,
                    ticket_number: ticketNumber,
                    subject,
                    category,
                    priority,
                    status: 'open',
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (ticketError) {
                return res.status(500).json(generateResponse(false, 'Failed to create support ticket'));
            }

            // Create initial message
            const { data: messageData, error: messageError } = await supabase
                .from('support_messages')
                .insert({
                    ticket_id: ticketData.id,
                    user_id: userId,
                    message,
                    is_staff_reply: false,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (messageError) {
                console.error('Failed to create initial message:', messageError);
            }

            // Send notification to support team (in a real implementation)
            // supportService.notifySupport(ticketData);

            res.status(201).json(generateResponse(true, 'Support ticket created successfully', {
                ticket: ticketData,
                message: messageData
            }));

            // Send notification to user
            await notificationService.sendSupportReplyNotification(userId, {
                ticket_id: ticketData.id,
                subject,
                reply_message: message,
                admin_name: 'Support Team'
            });

        } catch (error) {
            console.error('Create ticket error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get user's support tickets
    async getTickets(req, res) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 20, status, category } = req.query;

            // Build query
            let query = supabase
                .from('support_tickets')
                .select('*', { count: 'exact' })
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            // Apply filters
            if (status) {
                query = query.eq('status', status);
            }

            if (category) {
                query = query.eq('category', category);
            }

            // Apply pagination
            const offset = (parseInt(page) - 1) * parseInt(limit);
            query = query.range(offset, offset + parseInt(limit) - 1);

            const { data: tickets, error, count } = await query;

            if (error) {
                return res.status(500).json(generateResponse(false, 'Failed to retrieve support tickets'));
            }

            const totalPages = Math.ceil(count / parseInt(limit));

            res.json(generateResponse(true, 'Support tickets retrieved successfully', {
                tickets,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: totalPages,
                    total_records: count,
                    per_page: parseInt(limit)
                }
            }));

        } catch (error) {
            console.error('Get tickets error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get specific ticket with messages
    async getTicket(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            if (!id) {
                return res.status(400).json(generateResponse(false, 'Ticket ID is required'));
            }

            // Get ticket details
            const { data: ticketData, error: ticketError } = await supabase
                .from('support_tickets')
                .select('*')
                .eq('id', id)
                .eq('user_id', userId)
                .single();

            if (ticketError || !ticketData) {
                return res.status(404).json(generateResponse(false, 'Support ticket not found'));
            }

            // Get ticket messages
            const { data: messages, error: messagesError } = await supabase
                .from('support_messages')
                .select(`
                    *,
                    users!support_messages_user_id_fkey(full_name)
                `)
                .eq('ticket_id', id)
                .order('created_at', { ascending: true });

            if (messagesError) {
                console.error('Failed to retrieve messages:', messagesError);
            }

            // Mark messages as read by user
            await supabase
                .from('support_messages')
                .update({ read_by_user: true })
                .eq('ticket_id', id)
                .eq('is_staff_reply', true)
                .eq('read_by_user', false);

            res.json(generateResponse(true, 'Support ticket retrieved successfully', {
                ticket: ticketData,
                messages: messages || []
            }));

        } catch (error) {
            console.error('Get ticket error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Reply to a support ticket
    async replyToTicket(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const { message } = req.body;

            if (!id || !message) {
                return res.status(400).json(generateResponse(false, 'Ticket ID and message are required'));
            }

            // Check if ticket exists and belongs to user
            const { data: ticketData, error: ticketError } = await supabase
                .from('support_tickets')
                .select('id, status')
                .eq('id', id)
                .eq('user_id', userId)
                .single();

            if (ticketError || !ticketData) {
                return res.status(404).json(generateResponse(false, 'Support ticket not found'));
            }

            if (ticketData.status === 'closed') {
                return res.status(400).json(generateResponse(false, 'Cannot reply to a closed ticket'));
            }

            // Create message
            const { data: messageData, error: messageError } = await supabase
                .from('support_messages')
                .insert({
                    ticket_id: id,
                    user_id: userId,
                    message,
                    is_staff_reply: false,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (messageError) {
                return res.status(500).json(generateResponse(false, 'Failed to send message'));
            }

            // Update ticket status to 'awaiting_response' if it was 'pending_user'
            if (ticketData.status === 'pending_user') {
                await supabase
                    .from('support_tickets')
                    .update({
                        status: 'awaiting_response',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id);
            }

            // Notify support team of new reply
            // supportService.notifySupport(ticketData, messageData);

            res.json(generateResponse(true, 'Message sent successfully', messageData));

        } catch (error) {
            console.error('Reply to ticket error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Close a support ticket
    async closeTicket(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            if (!id) {
                return res.status(400).json(generateResponse(false, 'Ticket ID is required'));
            }

            // Check if ticket exists and belongs to user
            const { data: ticketData, error: ticketError } = await supabase
                .from('support_tickets')
                .select('id, status')
                .eq('id', id)
                .eq('user_id', userId)
                .single();

            if (ticketError || !ticketData) {
                return res.status(404).json(generateResponse(false, 'Support ticket not found'));
            }

            if (ticketData.status === 'closed') {
                return res.status(400).json(generateResponse(false, 'Ticket is already closed'));
            }

            // Update ticket status
            const { error: updateError } = await supabase
                .from('support_tickets')
                .update({
                    status: 'closed',
                    closed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (updateError) {
                return res.status(500).json(generateResponse(false, 'Failed to close ticket'));
            }

            res.json(generateResponse(true, 'Support ticket closed successfully'));

        } catch (error) {
            console.error('Close ticket error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Rate support ticket resolution
    async rateTicket(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const { rating, feedback } = req.body;

            if (!id || !rating) {
                return res.status(400).json(generateResponse(false, 'Ticket ID and rating are required'));
            }

            if (rating < 1 || rating > 5) {
                return res.status(400).json(generateResponse(false, 'Rating must be between 1 and 5'));
            }

            // Check if ticket exists, belongs to user, and is closed
            const { data: ticketData, error: ticketError } = await supabase
                .from('support_tickets')
                .select('id, status')
                .eq('id', id)
                .eq('user_id', userId)
                .single();

            if (ticketError || !ticketData) {
                return res.status(404).json(generateResponse(false, 'Support ticket not found'));
            }

            if (ticketData.status !== 'closed') {
                return res.status(400).json(generateResponse(false, 'Can only rate closed tickets'));
            }

            // Update ticket with rating
            const { error: updateError } = await supabase
                .from('support_tickets')
                .update({
                    rating: parseInt(rating),
                    feedback,
                    rated_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (updateError) {
                return res.status(500).json(generateResponse(false, 'Failed to rate ticket'));
            }

            res.json(generateResponse(true, 'Ticket rating submitted successfully'));

        } catch (error) {
            console.error('Rate ticket error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get support ticket statistics
    async getTicketStats(req, res) {
        try {
            const userId = req.user.id;

            // Get ticket counts by status
            const { data: tickets, error } = await supabase
                .from('support_tickets')
                .select('status, created_at')
                .eq('user_id', userId);

            if (error) {
                return res.status(500).json(generateResponse(false, 'Failed to retrieve ticket statistics'));
            }

            const stats = {
                total_tickets: tickets.length,
                open_tickets: tickets.filter(t => ['open', 'awaiting_response', 'pending_user'].includes(t.status)).length,
                closed_tickets: tickets.filter(t => t.status === 'closed').length,
                resolved_tickets: tickets.filter(t => t.status === 'resolved').length
            };

            // Calculate average resolution time for closed tickets (simplified)
            const closedTickets = tickets.filter(t => t.status === 'closed');
            if (closedTickets.length > 0) {
                // This is a simplified calculation - in a real implementation,
                // you'd track the actual resolution time in the database
                stats.average_resolution_time = '24 hours'; // Placeholder
            }

            res.json(generateResponse(true, 'Ticket statistics retrieved successfully', stats));

        } catch (error) {
            console.error('Get ticket stats error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get FAQ items
    async getFAQ(req, res) {
        try {
            const { category } = req.query;

            let query = supabase
                .from('faq_items')
                .select('*')
                .eq('is_published', true)
                .order('order_index', { ascending: true });

            if (category) {
                query = query.eq('category', category);
            }

            const { data: faqItems, error } = await query;

            if (error) {
                return res.status(500).json(generateResponse(false, 'Failed to retrieve FAQ items'));
            }

            res.json(generateResponse(true, 'FAQ items retrieved successfully', faqItems || []));

        } catch (error) {
            console.error('Get FAQ error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Search FAQ
    async searchFAQ(req, res) {
        try {
            const { query } = req.query;

            if (!query || query.length < 3) {
                return res.status(400).json(generateResponse(false, 'Search query must be at least 3 characters long'));
            }

            const { data: faqItems, error } = await supabase
                .from('faq_items')
                .select('*')
                .eq('is_published', true)
                .or(`question.ilike.%${query}%,answer.ilike.%${query}%`)
                .order('order_index', { ascending: true });

            if (error) {
                return res.status(500).json(generateResponse(false, 'Failed to search FAQ items'));
            }

            res.json(generateResponse(true, 'FAQ search completed successfully', faqItems || []));

        } catch (error) {
            console.error('Search FAQ error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }
}

module.exports = new SupportController();
