const { supabase } = require('../config/supabase');

class Transaction {
    constructor(data = {}) {
        this.id = data.id || null;
        this.user_id = data.user_id || null;
        this.type = data.type || '';
        this.amount = data.amount || 0.00;
        this.description = data.description || '';
        this.status = data.status || 'pending';
        this.payment_method = data.payment_method || null;
        this.payment_reference = data.payment_reference || null;
        this.balance_before = data.balance_before || 0.00;
        this.balance_after = data.balance_after || 0.00;
        this.metadata = data.metadata || {};
        this.error_message = data.error_message || null;
        this.processed_at = data.processed_at || null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    // Transaction types
    static get TYPES() {
        return {
            DEPOSIT: 'deposit',
            WITHDRAWAL: 'withdrawal',
            TRANSFER_IN: 'transfer_in',
            TRANSFER_OUT: 'transfer_out',
            AIRTIME_PURCHASE: 'airtime_purchase',
            DATA_PURCHASE: 'data_purchase',
            CABLE_PURCHASE: 'cable_purchase',
            ELECTRICITY_PURCHASE: 'electricity_purchase',
            REFERRAL_BONUS: 'referral_bonus',
            COMMISSION: 'commission',
            CREDIT: 'credit',
            DEBIT: 'debit'
        };
    }

    // Transaction statuses
    static get STATUSES() {
        return {
            PENDING: 'pending',
            PROCESSING: 'processing',
            COMPLETED: 'completed',
            FAILED: 'failed',
            CANCELLED: 'cancelled',
            REFUNDED: 'refunded'
        };
    }

    // Create new transaction
    static async create(transactionData) {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .insert({
                    ...transactionData,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            return new Transaction(data);
        } catch (error) {
            console.error('Create transaction error:', error);
            throw error;
        }
    }

    // Find transaction by ID
    static async findById(id) {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Transaction not found
                }
                throw error;
            }

            return new Transaction(data);
        } catch (error) {
            console.error('Find transaction by ID error:', error);
            throw error;
        }
    }

    // Find transaction by reference
    static async findByReference(reference) {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('payment_reference', reference)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Transaction not found
                }
                throw error;
            }

            return new Transaction(data);
        } catch (error) {
            console.error('Find transaction by reference error:', error);
            throw error;
        }
    }

    // Get user transactions
    static async getByUserId(userId, options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                type = null,
                status = null,
                startDate = null,
                endDate = null
            } = options;

            const offset = (page - 1) * limit;

            let query = supabase
                .from('transactions')
                .select('*', { count: 'exact' })
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            // Apply filters
            if (type) {
                query = query.eq('type', type);
            }

            if (status) {
                query = query.eq('status', status);
            }

            if (startDate) {
                query = query.gte('created_at', startDate);
            }

            if (endDate) {
                query = query.lte('created_at', endDate);
            }

            const { data, error, count } = await query;

            if (error) {
                throw error;
            }

            return {
                transactions: data.map(transactionData => new Transaction(transactionData)),
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            };

        } catch (error) {
            console.error('Get transactions by user ID error:', error);
            throw error;
        }
    }

    // Get all transactions (admin)
    static async getAll(options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                type = null,
                status = null,
                startDate = null,
                endDate = null
            } = options;

            const offset = (page - 1) * limit;

            let query = supabase
                .from('transactions')
                .select(`
                    *,
                    users!inner(full_name, email)
                `, { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            // Apply filters
            if (type) {
                query = query.eq('type', type);
            }

            if (status) {
                query = query.eq('status', status);
            }

            if (startDate) {
                query = query.gte('created_at', startDate);
            }

            if (endDate) {
                query = query.lte('created_at', endDate);
            }

            const { data, error, count } = await query;

            if (error) {
                throw error;
            }

            return {
                transactions: data.map(transactionData => new Transaction(transactionData)),
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            };

        } catch (error) {
            console.error('Get all transactions error:', error);
            throw error;
        }
    }

    // Update transaction
    async update(updateData) {
        try {
            const { data, error } = await supabase
                .from('transactions')
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
            console.error('Update transaction error:', error);
            throw error;
        }
    }

    // Mark as completed
    async markAsCompleted(metadata = {}) {
        try {
            const updateData = {
                status: Transaction.STATUSES.COMPLETED,
                processed_at: new Date().toISOString(),
                metadata: { ...this.metadata, ...metadata }
            };

            return await this.update(updateData);

        } catch (error) {
            console.error('Mark transaction as completed error:', error);
            throw error;
        }
    }

    // Mark as failed
    async markAsFailed(errorMessage, metadata = {}) {
        try {
            const updateData = {
                status: Transaction.STATUSES.FAILED,
                error_message: errorMessage,
                processed_at: new Date().toISOString(),
                metadata: { ...this.metadata, ...metadata }
            };

            return await this.update(updateData);

        } catch (error) {
            console.error('Mark transaction as failed error:', error);
            throw error;
        }
    }

    // Mark as processing
    async markAsProcessing(metadata = {}) {
        try {
            const updateData = {
                status: Transaction.STATUSES.PROCESSING,
                metadata: { ...this.metadata, ...metadata }
            };

            return await this.update(updateData);

        } catch (error) {
            console.error('Mark transaction as processing error:', error);
            throw error;
        }
    }

    // Cancel transaction
    async cancel(reason = 'Cancelled by user') {
        try {
            const updateData = {
                status: Transaction.STATUSES.CANCELLED,
                error_message: reason,
                processed_at: new Date().toISOString()
            };

            return await this.update(updateData);

        } catch (error) {
            console.error('Cancel transaction error:', error);
            throw error;
        }
    }

    // Refund transaction
    async refund(refundAmount = null, reason = 'Refund requested') {
        try {
            const updateData = {
                status: Transaction.STATUSES.REFUNDED,
                error_message: reason,
                processed_at: new Date().toISOString(),
                metadata: {
                    ...this.metadata,
                    refund_amount: refundAmount || this.amount,
                    refund_reason: reason
                }
            };

            return await this.update(updateData);

        } catch (error) {
            console.error('Refund transaction error:', error);
            throw error;
        }
    }

    // Get transaction statistics
    static async getStatistics(options = {}) {
        try {
            const {
                startDate = null,
                endDate = null,
                userId = null
            } = options;

            let query = supabase
                .from('transactions')
                .select('type, status, amount, created_at');

            if (userId) {
                query = query.eq('user_id', userId);
            }

            if (startDate) {
                query = query.gte('created_at', startDate);
            }

            if (endDate) {
                query = query.lte('created_at', endDate);
            }

            const { data: transactions, error } = await query;

            if (error) {
                throw error;
            }

            // Calculate statistics
            const stats = {
                total_transactions: transactions.length,
                total_amount: 0,
                by_status: {},
                by_type: {},
                success_rate: 0,
                average_amount: 0
            };

            let successfulTransactions = 0;

            transactions.forEach(transaction => {
                const amount = parseFloat(transaction.amount);
                stats.total_amount += amount;

                // Count by status
                stats.by_status[transaction.status] = (stats.by_status[transaction.status] || 0) + 1;

                // Count by type
                stats.by_type[transaction.type] = (stats.by_type[transaction.type] || 0) + 1;

                if (transaction.status === Transaction.STATUSES.COMPLETED) {
                    successfulTransactions++;
                }
            });

            if (stats.total_transactions > 0) {
                stats.success_rate = ((successfulTransactions / stats.total_transactions) * 100).toFixed(2);
                stats.average_amount = (stats.total_amount / stats.total_transactions).toFixed(2);
            }

            return stats;

        } catch (error) {
            console.error('Get transaction statistics error:', error);
            throw error;
        }
    }

    // Get revenue statistics
    static async getRevenueStatistics(period = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - period);

            const { data: transactions, error } = await supabase
                .from('transactions')
                .select('amount, created_at, type')
                .eq('status', Transaction.STATUSES.COMPLETED)
                .in('type', [
                    Transaction.TYPES.AIRTIME_PURCHASE,
                    Transaction.TYPES.DATA_PURCHASE,
                    Transaction.TYPES.CABLE_PURCHASE,
                    Transaction.TYPES.ELECTRICITY_PURCHASE
                ])
                .gte('created_at', startDate.toISOString());

            if (error) {
                throw error;
            }

            // Group by date
            const dailyRevenue = {};
            let totalRevenue = 0;

            transactions.forEach(transaction => {
                const date = transaction.created_at.split('T')[0];
                const amount = parseFloat(transaction.amount);

                if (!dailyRevenue[date]) {
                    dailyRevenue[date] = { date, revenue: 0, transactions: 0 };
                }

                dailyRevenue[date].revenue += amount;
                dailyRevenue[date].transactions++;
                totalRevenue += amount;
            });

            return {
                period_days: period,
                total_revenue: totalRevenue,
                average_daily_revenue: totalRevenue / period,
                daily_revenue: Object.values(dailyRevenue).sort((a, b) => a.date.localeCompare(b.date))
            };

        } catch (error) {
            console.error('Get revenue statistics error:', error);
            throw error;
        }
    }

    // Check if transaction is successful
    isSuccessful() {
        return this.status === Transaction.STATUSES.COMPLETED;
    }

    // Check if transaction is pending
    isPending() {
        return [
            Transaction.STATUSES.PENDING,
            Transaction.STATUSES.PROCESSING
        ].includes(this.status);
    }

    // Check if transaction failed
    isFailed() {
        return [
            Transaction.STATUSES.FAILED,
            Transaction.STATUSES.CANCELLED
        ].includes(this.status);
    }

    // Check if transaction can be retried
    canRetry() {
        return this.isFailed() && [
            Transaction.TYPES.AIRTIME_PURCHASE,
            Transaction.TYPES.DATA_PURCHASE,
            Transaction.TYPES.CABLE_PURCHASE,
            Transaction.TYPES.ELECTRICITY_PURCHASE
        ].includes(this.type);
    }

    // Get formatted amount
    getFormattedAmount() {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN'
        }).format(this.amount);
    }

    // Get transaction duration
    getDuration() {
        if (!this.processed_at) {
            return null;
        }

        const start = new Date(this.created_at);
        const end = new Date(this.processed_at);
        const durationMs = end - start;

        return {
            milliseconds: durationMs,
            seconds: Math.floor(durationMs / 1000),
            minutes: Math.floor(durationMs / (1000 * 60))
        };
    }

    // Convert to JSON
    toJSON() {
        return {
            id: this.id,
            user_id: this.user_id,
            type: this.type,
            amount: this.amount,
            description: this.description,
            status: this.status,
            payment_method: this.payment_method,
            payment_reference: this.payment_reference,
            balance_before: this.balance_before,
            balance_after: this.balance_after,
            metadata: this.metadata,
            error_message: this.error_message,
            processed_at: this.processed_at,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
}

module.exports = Transaction;
