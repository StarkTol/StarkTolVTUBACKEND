const { supabase } = require('../config/supabase');

class SupportService {
    // Create notification for new ticket
    async notifySupport(ticketData, messageData = null) {
        try {
            // In a real implementation, this would send emails/SMS to support team
            console.log('Support notification:', {
                ticket_id: ticketData.id,
                subject: ticketData.subject,
                priority: ticketData.priority,
                category: ticketData.category,
                user_id: ticketData.user_id,
                created_at: ticketData.created_at
            });

            // Log notification
            await supabase
                .from('support_notifications')
                .insert({
                    ticket_id: ticketData.id,
                    type: messageData ? 'new_reply' : 'new_ticket',
                    message: messageData ? 'New reply from customer' : 'New support ticket created',
                    sent_at: new Date().toISOString()
                });

            return { success: true };

        } catch (error) {
            console.error('Notify support error:', error);
            return { success: false, error: error.message };
        }
    }

    // Auto-assign ticket to available support agent
    async autoAssignTicket(ticketId) {
        try {
            // Get available support agents (simplified logic)
            const { data: agents, error: agentsError } = await supabase
                .from('support_agents')
                .select('*')
                .eq('status', 'available')
                .order('last_assigned', { ascending: true })
                .limit(1);

            if (agentsError || !agents || agents.length === 0) {
                console.log('No available support agents');
                return { success: false, message: 'No available agents' };
            }

            const assignedAgent = agents[0];

            // Assign ticket to agent
            const { error: assignError } = await supabase
                .from('support_tickets')
                .update({
                    assigned_to: assignedAgent.user_id,
                    status: 'assigned',
                    assigned_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', ticketId);

            if (assignError) {
                console.error('Assign ticket error:', assignError);
                return { success: false, error: assignError.message };
            }

            // Update agent's last assigned time
            await supabase
                .from('support_agents')
                .update({
                    last_assigned: new Date().toISOString(),
                    active_tickets: assignedAgent.active_tickets + 1
                })
                .eq('user_id', assignedAgent.user_id);

            return {
                success: true,
                assigned_to: assignedAgent.user_id,
                agent_name: assignedAgent.name
            };

        } catch (error) {
            console.error('Auto assign ticket error:', error);
            return { success: false, error: error.message };
        }
    }

    // Escalate ticket based on priority and time
    async escalateTicket(ticketId, reason = 'Time threshold exceeded') {
        try {
            const { data: ticketData, error: ticketError } = await supabase
                .from('support_tickets')
                .select('*')
                .eq('id', ticketId)
                .single();

            if (ticketError || !ticketData) {
                return { success: false, message: 'Ticket not found' };
            }

            // Update ticket priority and status
            let newPriority = ticketData.priority;
            if (ticketData.priority === 'low') newPriority = 'medium';
            else if (ticketData.priority === 'medium') newPriority = 'high';
            else if (ticketData.priority === 'high') newPriority = 'urgent';

            const { error: updateError } = await supabase
                .from('support_tickets')
                .update({
                    priority: newPriority,
                    escalated: true,
                    escalated_at: new Date().toISOString(),
                    escalation_reason: reason,
                    updated_at: new Date().toISOString()
                })
                .eq('id', ticketId);

            if (updateError) {
                return { success: false, error: updateError.message };
            }

            // Log escalation
            await supabase
                .from('support_escalations')
                .insert({
                    ticket_id: ticketId,
                    from_priority: ticketData.priority,
                    to_priority: newPriority,
                    reason,
                    escalated_by: 'system',
                    created_at: new Date().toISOString()
                });

            return {
                success: true,
                from_priority: ticketData.priority,
                to_priority: newPriority,
                reason
            };

        } catch (error) {
            console.error('Escalate ticket error:', error);
            return { success: false, error: error.message };
        }
    }

    // Get support agent performance metrics
    async getAgentPerformance(agentId, period = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - period);

            // Get tickets handled by agent
            const { data: tickets, error: ticketsError } = await supabase
                .from('support_tickets')
                .select('*')
                .eq('assigned_to', agentId)
                .gte('created_at', startDate.toISOString());

            if (ticketsError) {
                throw ticketsError;
            }

            // Get agent ratings
            const { data: ratings, error: ratingsError } = await supabase
                .from('support_tickets')
                .select('rating')
                .eq('assigned_to', agentId)
                .not('rating', 'is', null)
                .gte('created_at', startDate.toISOString());

            if (ratingsError) {
                console.error('Ratings error:', ratingsError);
            }

            // Calculate metrics
            const metrics = {
                total_tickets: tickets.length,
                resolved_tickets: tickets.filter(t => t.status === 'resolved').length,
                closed_tickets: tickets.filter(t => t.status === 'closed').length,
                escalated_tickets: tickets.filter(t => t.escalated).length,
                avg_rating: 0,
                avg_resolution_time: 0,
                response_time: 0
            };

            // Calculate average rating
            if (ratings && ratings.length > 0) {
                const totalRating = ratings.reduce((sum, r) => sum + r.rating, 0);
                metrics.avg_rating = (totalRating / ratings.length).toFixed(2);
            }

            // Calculate average resolution time (simplified)
            const resolvedTickets = tickets.filter(t => t.status === 'resolved' && t.resolved_at);
            if (resolvedTickets.length > 0) {
                const totalResolutionTime = resolvedTickets.reduce((sum, t) => {
                    const created = new Date(t.created_at);
                    const resolved = new Date(t.resolved_at);
                    return sum + (resolved - created);
                }, 0);
                metrics.avg_resolution_time = Math.round(totalResolutionTime / resolvedTickets.length / (1000 * 60 * 60)); // hours
            }

            return metrics;

        } catch (error) {
            console.error('Get agent performance error:', error);
            throw new Error('Failed to retrieve agent performance metrics');
        }
    }

    // Auto-categorize ticket based on content
    async autoCategorizeTicket(subject, message) {
        try {
            const content = `${subject} ${message}`.toLowerCase();

            // Simple keyword-based categorization
            const categories = {
                technical: ['error', 'bug', 'not working', 'failed', 'problem', 'issue', 'crash'],
                billing: ['payment', 'charge', 'bill', 'invoice', 'refund', 'money', 'cost'],
                vtu_services: ['airtime', 'data', 'cable', 'electricity', 'recharge', 'subscription'],
                account: ['login', 'password', 'profile', 'signup', 'register', 'account'],
                general: ['help', 'question', 'how to', 'information', 'inquiry']
            };

            for (const [category, keywords] of Object.entries(categories)) {
                if (keywords.some(keyword => content.includes(keyword))) {
                    return category;
                }
            }

            return 'general'; // Default category

        } catch (error) {
            console.error('Auto categorize ticket error:', error);
            return 'general';
        }
    }

    // Generate ticket statistics
    async getTicketStatistics(period = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - period);

            const { data: tickets, error } = await supabase
                .from('support_tickets')
                .select('status, priority, category, rating, created_at, resolved_at')
                .gte('created_at', startDate.toISOString());

            if (error) {
                throw error;
            }

            const stats = {
                total_tickets: tickets.length,
                by_status: {},
                by_priority: {},
                by_category: {},
                avg_rating: 0,
                resolution_rate: 0,
                avg_resolution_time: 0
            };

            // Count by status
            tickets.forEach(ticket => {
                stats.by_status[ticket.status] = (stats.by_status[ticket.status] || 0) + 1;
                stats.by_priority[ticket.priority] = (stats.by_priority[ticket.priority] || 0) + 1;
                stats.by_category[ticket.category] = (stats.by_category[ticket.category] || 0) + 1;
            });

            // Calculate average rating
            const ratedTickets = tickets.filter(t => t.rating);
            if (ratedTickets.length > 0) {
                const totalRating = ratedTickets.reduce((sum, t) => sum + t.rating, 0);
                stats.avg_rating = (totalRating / ratedTickets.length).toFixed(2);
            }

            // Calculate resolution rate
            const resolvedTickets = tickets.filter(t => ['resolved', 'closed'].includes(t.status));
            if (tickets.length > 0) {
                stats.resolution_rate = ((resolvedTickets.length / tickets.length) * 100).toFixed(2);
            }

            // Calculate average resolution time
            const timedTickets = tickets.filter(t => t.resolved_at);
            if (timedTickets.length > 0) {
                const totalTime = timedTickets.reduce((sum, t) => {
                    const created = new Date(t.created_at);
                    const resolved = new Date(t.resolved_at);
                    return sum + (resolved - created);
                }, 0);
                stats.avg_resolution_time = Math.round(totalTime / timedTickets.length / (1000 * 60 * 60)); // hours
            }

            return stats;

        } catch (error) {
            console.error('Get ticket statistics error:', error);
            throw new Error('Failed to retrieve ticket statistics');
        }
    }

    // Create canned response
    async createCannedResponse(title, content, category, isPublic = true) {
        try {
            const { data, error } = await supabase
                .from('canned_responses')
                .insert({
                    title,
                    content,
                    category,
                    is_public: isPublic,
                    usage_count: 0,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            return { success: true, response: data };

        } catch (error) {
            console.error('Create canned response error:', error);
            throw new Error('Failed to create canned response');
        }
    }

    // Get canned responses
    async getCannedResponses(category = null) {
        try {
            let query = supabase
                .from('canned_responses')
                .select('*')
                .eq('is_active', true)
                .order('usage_count', { ascending: false });

            if (category) {
                query = query.eq('category', category);
            }

            const { data, error } = await query;

            if (error) {
                throw error;
            }

            return data;

        } catch (error) {
            console.error('Get canned responses error:', error);
            throw new Error('Failed to retrieve canned responses');
        }
    }

    // Search knowledge base
    async searchKnowledgeBase(query, category = null) {
        try {
            let searchQuery = supabase
                .from('knowledge_base')
                .select('*')
                .eq('is_published', true)
                .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
                .order('views', { ascending: false });

            if (category) {
                searchQuery = searchQuery.eq('category', category);
            }

            const { data, error } = await searchQuery;

            if (error) {
                throw error;
            }

            return data;

        } catch (error) {
            console.error('Search knowledge base error:', error);
            throw new Error('Failed to search knowledge base');
        }
    }
}

const supportService = new SupportService();
module.exports = { supportService };
