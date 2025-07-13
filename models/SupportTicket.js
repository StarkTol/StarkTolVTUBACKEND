const { supabase } = require('../config/supabase');

class SupportTicket {
    constructor(data = {}) {
        this.id = data.id || null;
        this.user_id = data.user_id || null;
        this.ticket_number = data.ticket_number || '';
        this.subject = data.subject || '';
        this.category = data.category || 'general';
        this.priority = data.priority || 'medium';
        this.status = data.status || 'open';
        this.assigned_to = data.assigned_to || null;
        this.rating = data.rating || null;
        this.feedback = data.feedback || null;
        this.escalated = data.escalated || false;
        this.escalated_at = data.escalated_at || null;
        this.escalation_reason = data.escalation_reason || null;
        this.assigned_at = data.assigned_at || null;
        this.resolved_at = data.resolved_at || null;
        this.closed_at = data.closed_at || null;
        this.rated_at = data.rated_at || null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    // Support ticket categories
    static get CATEGORIES() {
        return {
            TECHNICAL: 'technical',
            BILLING: 'billing',
            VTU_SERVICES: 'vtu_services',
            ACCOUNT: 'account',
            GENERAL: 'general'
        };
    }

    // Support ticket priorities
    static get PRIORITIES() {
        return {
            LOW: 'low',
            MEDIUM: 'medium',
            HIGH: 'high',
            URGENT: 'urgent'
        };
    }

    // Support ticket statuses
    static get STATUSES() {
        return {
            OPEN: 'open',
            ASSIGNED: 'assigned',
            AWAITING_RESPONSE: 'awaiting_response',
            PENDING_USER: 'pending_user',
            RESOLVED: 'resolved',
            CLOSED: 'closed'
        };
    }

    // Create new support ticket
    static async create(ticketData) {
        try {
            const { data, error } = await supabase
                .from('support_tickets')
                .insert({
                    ...ticketData,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            return new SupportTicket(data);
        } catch (error) {
            console.error('Create support ticket error:', error);
            throw error;
        }
    }

    // Find support ticket by ID
    static async findById(id) {
        try {
            const { data, error } = await supabase
                .from('support_tickets')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Ticket not found
                }
                throw error;
            }

            return new SupportTicket(data);
        } catch (error) {
            console.error('Find support ticket by ID error:', error);
            throw error;
        }
    }

    // Find support ticket by ticket number
    static async findByTicketNumber(ticketNumber) {
        try {
            const { data, error } = await supabase
                .from('support_tickets')
                .select('*')
                .eq('ticket_number', ticketNumber)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Ticket not found
                }
                throw error;
            }

            return new SupportTicket(data);
        } catch (error) {
            console.error('Find support ticket by number error:', error);
            throw error;
        }
    }

    // Get tickets by user ID
    static async getByUserId(userId, options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                status = null,
                category = null,
                priority = null
            } = options;

            const offset = (page - 1) * limit;

            let query = supabase
                .from('support_tickets')
                .select('*', { count: 'exact' })
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            // Apply filters
            if (status) {
                query = query.eq('status', status);
            }

            if (category) {
                query = query.eq('category', category);
            }

            if (priority) {
                query = query.eq('priority', priority);
            }

            const { data, error, count } = await query;

            if (error) {
                throw error;
            }

            return {
                tickets: data.map(ticketData => new SupportTicket(ticketData)),
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            };

        } catch (error) {
            console.error('Get tickets by user ID error:', error);
            throw error;
        }
    }

    // Get all tickets (admin)
    static async getAll(options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                status = null,
                category = null,
                priority = null,
                assigned_to = null,
                search = null
            } = options;

            const offset = (page - 1) * limit;

            let query = supabase
                .from('support_tickets')
                .select(`
                    *,
                    users!inner(full_name, email, phone)
                `, { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            // Apply filters
            if (status) {
                query = query.eq('status', status);
            }

            if (category) {
                query = query.eq('category', category);
            }

            if (priority) {
                query = query.eq('priority', priority);
            }

            if (assigned_to) {
                query = query.eq('assigned_to', assigned_to);
            }

            if (search) {
                query = query.or(`ticket_number.ilike.%${search}%,subject.ilike.%${search}%`);
            }

            const { data, error, count } = await query;

            if (error) {
                throw error;
            }

            return {
                tickets: data.map(ticketData => new SupportTicket(ticketData)),
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            };

        } catch (error) {
            console.error('Get all tickets error:', error);
            throw error;
        }
    }

    // Update support ticket
    async update(updateData) {
        try {
            const { data, error } = await supabase
                .from('support_tickets')
                .update({
                    ...updateData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.id)
                .select()
                .single();

            if (error) {
                throw error;
            }

            // Update current instance
            Object.assign(this, data);
            return this;

        } catch (error) {
            console.error('Update support ticket error:', error);
            throw error;
        }
    }

    // Assign ticket to agent
    async assign(agentId) {
        try {
            const updateData = {
                assigned_to: agentId,
                status: SupportTicket.STATUSES.ASSIGNED,
                assigned_at: new Date().toISOString()
            };

            return await this.update(updateData);

        } catch (error) {
            console.error('Assign ticket error:', error);
            throw error;
        }
    }

    // Mark ticket as awaiting response
    async markAwaitingResponse() {
        try {
            const updateData = {
                status: SupportTicket.STATUSES.AWAITING_RESPONSE
            };

            return await this.update(updateData);

        } catch (error) {
            console.error('Mark awaiting response error:', error);
            throw error;
        }
    }

    // Mark ticket as pending user
    async markPendingUser() {
        try {
            const updateData = {
                status: SupportTicket.STATUSES.PENDING_USER
            };

            return await this.update(updateData);

        } catch (error) {
            console.error('Mark pending user error:', error);
            throw error;
        }
    }

    // Resolve ticket
    async resolve() {
        try {
            const updateData = {
                status: SupportTicket.STATUSES.RESOLVED,
                resolved_at: new Date().toISOString()
            };

            return await this.update(updateData);

        } catch (error) {
            console.error('Resolve ticket error:', error);
            throw error;
        }
    }

    // Close ticket
    async close() {
        try {
            const updateData = {
                status: SupportTicket.STATUSES.CLOSED,
                closed_at: new Date().toISOString()
            };

            return await this.update(updateData);

        } catch (error) {
            console.error('Close ticket error:', error);
            throw error;
        }
    }

    // Escalate ticket
    async escalate(reason = 'Time threshold exceeded') {
        try {
            let newPriority = this.priority;
            if (this.priority === SupportTicket.PRIORITIES.LOW) {
                newPriority = SupportTicket.PRIORITIES.MEDIUM;
            } else if (this.priority === SupportTicket.PRIORITIES.MEDIUM) {
                newPriority = SupportTicket.PRIORITIES.HIGH;
            } else if (this.priority === SupportTicket.PRIORITIES.HIGH) {
                newPriority = SupportTicket.PRIORITIES.URGENT;
            }

            const updateData = {
                priority: newPriority,
                escalated: true,
                escalated_at: new Date().toISOString(),
                escalation_reason: reason
            };

            return await this.update(updateData);

        } catch (error) {
            console.error('Escalate ticket error:', error);
            throw error;
        }
    }

    // Rate ticket
    async rate(rating, feedback = null) {
        try {
            if (rating < 1 || rating > 5) {
                throw new Error('Rating must be between 1 and 5');
            }

            const updateData = {
                rating: parseInt(rating),
                feedback,
                rated_at: new Date().toISOString()
            };

            return await this.update(updateData);

        } catch (error) {
            console.error('Rate ticket error:', error);
            throw error;
        }
    }

    // Get ticket messages
    async getMessages() {
        try {
            const { data, error } = await supabase
                .from('support_messages')
                .select(`
                    *,
                    users!support_messages_user_id_fkey(full_name)
                `)
                .eq('ticket_id', this.id)
                .order('created_at', { ascending: true });

            if (error) {
                throw error;
            }

            return data || [];

        } catch (error) {
            console.error('Get ticket messages error:', error);
            throw error;
        }
    }

    // Add message to ticket
    async addMessage(userId, message, isStaffReply = false) {
        try {
            const { data, error } = await supabase
                .from('support_messages')
                .insert({
                    ticket_id: this.id,
                    user_id: userId,
                    message,
                    is_staff_reply: isStaffReply,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            // Update ticket status based on who replied
            if (isStaffReply) {
                await this.markPendingUser();
            } else {
                await this.markAwaitingResponse();
            }

            return data;

        } catch (error) {
            console.error('Add message error:', error);
            throw error;
        }
    }

    // Get ticket statistics
    static async getStatistics(options = {}) {
        try {
            const {
                startDate = null,
                endDate = null,
                userId = null,
                agentId = null
            } = options;

            let query = supabase
                .from('support_tickets')
                .select('status, priority, category, rating, created_at, resolved_at');

            if (userId) {
                query = query.eq('user_id', userId);
            }

            if (agentId) {
                query = query.eq('assigned_to', agentId);
            }

            if (startDate) {
                query = query.gte('created_at', startDate);
            }

            if (endDate) {
                query = query.lte('created_at', endDate);
            }

            const { data: tickets, error } = await query;

            if (error) {
                throw error;
            }

            // Calculate statistics
            const stats = {
                total_tickets: tickets.length,
                by_status: {},
                by_priority: {},
                by_category: {},
                avg_rating: 0,
                resolution_rate: 0,
                avg_resolution_time: 0
            };

            // Count by status, priority, and category
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
            const resolvedTickets = tickets.filter(t => 
                [SupportTicket.STATUSES.RESOLVED, SupportTicket.STATUSES.CLOSED].includes(t.status)
            );
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
            throw error;
        }
    }

    // Check if ticket is open
    isOpen() {
        return [
            SupportTicket.STATUSES.OPEN,
            SupportTicket.STATUSES.ASSIGNED,
            SupportTicket.STATUSES.AWAITING_RESPONSE,
            SupportTicket.STATUSES.PENDING_USER
        ].includes(this.status);
    }

    // Check if ticket is closed
    isClosed() {
        return [
            SupportTicket.STATUSES.RESOLVED,
            SupportTicket.STATUSES.CLOSED
        ].includes(this.status);
    }

    // Check if ticket is overdue
    isOverdue() {
        if (this.isClosed()) {
            return false;
        }

        const now = new Date();
        const created = new Date(this.created_at);
        const hoursElapsed = (now - created) / (1000 * 60 * 60);

        // Define SLA hours based on priority
        const slaHours = {
            [SupportTicket.PRIORITIES.URGENT]: 2,
            [SupportTicket.PRIORITIES.HIGH]: 8,
            [SupportTicket.PRIORITIES.MEDIUM]: 24,
            [SupportTicket.PRIORITIES.LOW]: 72
        };

        return hoursElapsed > (slaHours[this.priority] || 24);
    }

    // Get ticket age in hours
    getAgeInHours() {
        const now = new Date();
        const created = new Date(this.created_at);
        return Math.floor((now - created) / (1000 * 60 * 60));
    }

    // Get resolution time in hours
    getResolutionTimeInHours() {
        if (!this.resolved_at) {
            return null;
        }

        const created = new Date(this.created_at);
        const resolved = new Date(this.resolved_at);
        return Math.floor((resolved - created) / (1000 * 60 * 60));
    }

    // Convert to JSON
    toJSON() {
        return {
            id: this.id,
            user_id: this.user_id,
            ticket_number: this.ticket_number,
            subject: this.subject,
            category: this.category,
            priority: this.priority,
            status: this.status,
            assigned_to: this.assigned_to,
            rating: this.rating,
            feedback: this.feedback,
            escalated: this.escalated,
            escalated_at: this.escalated_at,
            escalation_reason: this.escalation_reason,
            assigned_at: this.assigned_at,
            resolved_at: this.resolved_at,
            closed_at: this.closed_at,
            rated_at: this.rated_at,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
}

module.exports = SupportTicket;
