const { supabase } = require('../config/supabase');

class SubReseller {
    constructor(data = {}) {
        this.id = data.id || null;
        this.user_id = data.user_id || null;
        this.reseller_id = data.reseller_id || null;
        this.sub_reseller_code = data.sub_reseller_code || '';
        this.commission_percentage = data.commission_percentage || 0;
        this.status = data.status || 'active';
        this.total_sales = data.total_sales || 0;
        this.total_commission = data.total_commission || 0;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    // Sub-reseller statuses
    static get STATUSES() {
        return {
            ACTIVE: 'active',
            INACTIVE: 'inactive',
            SUSPENDED: 'suspended'
        };
    }

    // Create new sub-reseller
    static async create(subResellerData) {
        try {
            const { data, error } = await supabase
                .from('sub_resellers')
                .insert({
                    ...subResellerData,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            return new SubReseller(data);
        } catch (error) {
            console.error('Create sub-reseller error:', error);
            throw error;
        }
    }

    // Find sub-reseller by ID
    static async findById(id) {
        try {
            const { data, error } = await supabase
                .from('sub_resellers')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Sub-reseller not found
                }
                throw error;
            }

            return new SubReseller(data);
        } catch (error) {
            console.error('Find sub-reseller by ID error:', error);
            throw error;
        }
    }

    // Find sub-reseller by user ID
    static async findByUserId(userId) {
        try {
            const { data, error } = await supabase
                .from('sub_resellers')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Sub-reseller not found
                }
                throw error;
            }

            return new SubReseller(data);
        } catch (error) {
            console.error('Find sub-reseller by user ID error:', error);
            throw error;
        }
    }

    // Find sub-reseller by code
    static async findByCode(subResellerCode) {
        try {
            const { data, error } = await supabase
                .from('sub_resellers')
                .select('*')
                .eq('sub_reseller_code', subResellerCode)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Sub-reseller not found
                }
                throw error;
            }

            return new SubReseller(data);
        } catch (error) {
            console.error('Find sub-reseller by code error:', error);
            throw error;
        }
    }

    // Get sub-resellers by reseller ID
    static async getByResellerId(resellerId, options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                status = null
            } = options;

            const offset = (page - 1) * limit;

            let query = supabase
                .from('sub_resellers')
                .select(`
                    *,
                    users!inner(full_name, email, phone, created_at),
                    resellers!inner(business_name, reseller_code)
                `, { count: 'exact' })
                .eq('reseller_id', resellerId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (status) {
                query = query.eq('status', status);
            }

            const { data, error, count } = await query;

            if (error) {
                throw error;
            }

            return {
                sub_resellers: data.map(subResellerData => new SubReseller(subResellerData)),
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            };

        } catch (error) {
            console.error('Get sub-resellers by reseller ID error:', error);
            throw error;
        }
    }

    // Get all sub-resellers with pagination
    static async getAll(options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                status = null,
                search = null
            } = options;

            const offset = (page - 1) * limit;

            let query = supabase
                .from('sub_resellers')
                .select(`
                    *,
                    users!inner(full_name, email, phone, created_at),
                    resellers!inner(business_name, reseller_code)
                `, { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            // Apply filters
            if (status) {
                query = query.eq('status', status);
            }

            if (search) {
                query = query.or(`sub_reseller_code.ilike.%${search}%`);
            }

            const { data, error, count } = await query;

            if (error) {
                throw error;
            }

            return {
                sub_resellers: data.map(subResellerData => new SubReseller(subResellerData)),
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            };

        } catch (error) {
            console.error('Get all sub-resellers error:', error);
            throw error;
        }
    }

    // Update sub-reseller
    async update(updateData) {
        try {
            const { data, error } = await supabase
                .from('sub_resellers')
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
            console.error('Update sub-reseller error:', error);
            throw error;
        }
    }

    // Activate sub-reseller
    async activate() {
        try {
            const updateData = {
                status: SubReseller.STATUSES.ACTIVE
            };

            const updatedSubReseller = await this.update(updateData);

            // Update user role to sub_reseller
            await supabase
                .from('users')
                .update({ role: 'sub_reseller' })
                .eq('id', this.user_id);

            return updatedSubReseller;

        } catch (error) {
            console.error('Activate sub-reseller error:', error);
            throw error;
        }
    }

    // Deactivate sub-reseller
    async deactivate(reason = 'Deactivated by reseller') {
        try {
            const updateData = {
                status: SubReseller.STATUSES.INACTIVE,
                deactivation_reason: reason,
                deactivated_at: new Date().toISOString()
            };

            const updatedSubReseller = await this.update(updateData);

            // Update user role back to user
            await supabase
                .from('users')
                .update({ role: 'user' })
                .eq('id', this.user_id);

            return updatedSubReseller;

        } catch (error) {
            console.error('Deactivate sub-reseller error:', error);
            throw error;
        }
    }

    // Suspend sub-reseller
    async suspend(reason = 'Administrative action') {
        try {
            const updateData = {
                status: SubReseller.STATUSES.SUSPENDED,
                suspension_reason: reason,
                suspended_at: new Date().toISOString()
            };

            const updatedSubReseller = await this.update(updateData);

            // Update user role back to user
            await supabase
                .from('users')
                .update({ role: 'user' })
                .eq('id', this.user_id);

            return updatedSubReseller;

        } catch (error) {
            console.error('Suspend sub-reseller error:', error);
            throw error;
        }
    }

    // Update commission percentage
    async updateCommission(newCommissionPercentage) {
        try {
            if (newCommissionPercentage < 0 || newCommissionPercentage > 50) {
                throw new Error('Commission percentage must be between 0 and 50');
            }

            const updateData = {
                commission_percentage: newCommissionPercentage
            };

            return await this.update(updateData);

        } catch (error) {
            console.error('Update commission error:', error);
            throw error;
        }
    }

    // Get sub-reseller statistics
    async getStatistics(period = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - period);

            // Get transaction stats
            const { data: transactions, error: transactionError } = await supabase
                .from('transactions')
                .select('type, amount, status, created_at')
                .eq('user_id', this.user_id)
                .gte('created_at', startDate.toISOString());

            if (transactionError) {
                throw transactionError;
            }

            // Get commission stats
            const { data: commissions, error: commissionError } = await supabase
                .from('sub_reseller_commissions')
                .select('amount')
                .eq('sub_reseller_id', this.id)
                .gte('created_at', startDate.toISOString());

            if (commissionError) {
                console.error('Commission stats error:', commissionError);
            }

            // Calculate statistics
            const stats = {
                period_days: period,
                total_sales: 0,
                successful_transactions: 0,
                failed_transactions: 0,
                total_commission: 0,
                sales_by_service: {
                    airtime: 0,
                    data: 0,
                    cable: 0,
                    electricity: 0
                }
            };

            if (transactions) {
                transactions.forEach(transaction => {
                    const amount = parseFloat(transaction.amount);
                    
                    if (transaction.status === 'completed') {
                        stats.total_sales += amount;
                        stats.successful_transactions++;

                        // Count by service type
                        if (transaction.type === 'airtime_purchase') {
                            stats.sales_by_service.airtime += amount;
                        } else if (transaction.type === 'data_purchase') {
                            stats.sales_by_service.data += amount;
                        } else if (transaction.type === 'cable_purchase') {
                            stats.sales_by_service.cable += amount;
                        } else if (transaction.type === 'electricity_purchase') {
                            stats.sales_by_service.electricity += amount;
                        }
                    } else if (transaction.status === 'failed') {
                        stats.failed_transactions++;
                    }
                });
            }

            if (commissions) {
                stats.total_commission = commissions.reduce((sum, c) => sum + parseFloat(c.amount), 0);
            }

            return stats;

        } catch (error) {
            console.error('Get sub-reseller statistics error:', error);
            throw error;
        }
    }

    // Get reseller information
    async getReseller() {
        try {
            const { data, error } = await supabase
                .from('resellers')
                .select(`
                    *,
                    users!inner(full_name, email, business_name)
                `)
                .eq('user_id', this.reseller_id)
                .single();

            if (error) {
                throw error;
            }

            return data;

        } catch (error) {
            console.error('Get reseller error:', error);
            throw error;
        }
    }

    // Process commission for transaction
    async processCommission(transactionId, transactionAmount) {
        try {
            const commissionAmount = (parseFloat(transactionAmount) * this.commission_percentage) / 100;

            // Create commission record
            const { data: commissionData, error } = await supabase
                .from('sub_reseller_commissions')
                .insert({
                    sub_reseller_id: this.id,
                    transaction_id: transactionId,
                    amount: commissionAmount,
                    commission_percentage: this.commission_percentage,
                    status: 'earned',
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            // Update total commission
            await this.update({
                total_commission: parseFloat(this.total_commission) + commissionAmount
            });

            return commissionData;

        } catch (error) {
            console.error('Process commission error:', error);
            throw error;
        }
    }

    // Get commission history
    async getCommissionHistory(options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                startDate = null,
                endDate = null
            } = options;

            const offset = (page - 1) * limit;

            let query = supabase
                .from('sub_reseller_commissions')
                .select(`
                    *,
                    transactions!inner(type, description, created_at)
                `, { count: 'exact' })
                .eq('sub_reseller_id', this.id)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            // Apply date filters
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
                commissions: data,
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            };

        } catch (error) {
            console.error('Get commission history error:', error);
            throw error;
        }
    }

    // Check if sub-reseller is active
    isActive() {
        return this.status === SubReseller.STATUSES.ACTIVE;
    }

    // Check if sub-reseller is inactive
    isInactive() {
        return this.status === SubReseller.STATUSES.INACTIVE;
    }

    // Check if sub-reseller is suspended
    isSuspended() {
        return this.status === SubReseller.STATUSES.SUSPENDED;
    }

    // Calculate commission for amount
    calculateCommission(amount) {
        return (parseFloat(amount) * this.commission_percentage) / 100;
    }

    // Convert to JSON
    toJSON() {
        return {
            id: this.id,
            user_id: this.user_id,
            reseller_id: this.reseller_id,
            sub_reseller_code: this.sub_reseller_code,
            commission_percentage: this.commission_percentage,
            status: this.status,
            total_sales: this.total_sales,
            total_commission: this.total_commission,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
}

module.exports = SubReseller;
