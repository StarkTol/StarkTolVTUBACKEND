const { supabase } = require('../config/supabase');

class Reseller {
    constructor(data = {}) {
        this.id = data.id || null;
        this.user_id = data.user_id || null;
        this.business_name = data.business_name || '';
        this.business_address = data.business_address || '';
        this.business_phone = data.business_phone || '';
        this.website = data.website || null;
        this.expected_monthly_volume = data.expected_monthly_volume || 0;
        this.reseller_code = data.reseller_code || '';
        this.status = data.status || 'pending';
        this.level = data.level || 'basic';
        this.airtime_discount = data.airtime_discount || 0;
        this.data_discount = data.data_discount || 0;
        this.cable_discount = data.cable_discount || 0;
        this.electricity_discount = data.electricity_discount || 0;
        this.airtime_commission = data.airtime_commission || 0;
        this.data_commission = data.data_commission || 0;
        this.cable_commission = data.cable_commission || 0;
        this.electricity_commission = data.electricity_commission || 0;
        this.applied_at = data.applied_at || null;
        this.approved_at = data.approved_at || null;
        this.upgraded_at = data.upgraded_at || null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    // Reseller statuses
    static get STATUSES() {
        return {
            PENDING: 'pending',
            APPROVED: 'approved',
            REJECTED: 'rejected',
            SUSPENDED: 'suspended'
        };
    }

    // Reseller levels
    static get LEVELS() {
        return {
            BASIC: 'basic',
            SILVER: 'silver',
            GOLD: 'gold',
            PLATINUM: 'platinum'
        };
    }

    // Create new reseller application
    static async create(resellerData) {
        try {
            const { data, error } = await supabase
                .from('resellers')
                .insert({
                    ...resellerData,
                    created_at: new Date().toISOString(),
                    applied_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            return new Reseller(data);
        } catch (error) {
            console.error('Create reseller error:', error);
            throw error;
        }
    }

    // Find reseller by ID
    static async findById(id) {
        try {
            const { data, error } = await supabase
                .from('resellers')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Reseller not found
                }
                throw error;
            }

            return new Reseller(data);
        } catch (error) {
            console.error('Find reseller by ID error:', error);
            throw error;
        }
    }

    // Find reseller by user ID
    static async findByUserId(userId) {
        try {
            const { data, error } = await supabase
                .from('resellers')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Reseller not found
                }
                throw error;
            }

            return new Reseller(data);
        } catch (error) {
            console.error('Find reseller by user ID error:', error);
            throw error;
        }
    }

    // Find reseller by code
    static async findByCode(resellerCode) {
        try {
            const { data, error } = await supabase
                .from('resellers')
                .select('*')
                .eq('reseller_code', resellerCode)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Reseller not found
                }
                throw error;
            }

            return new Reseller(data);
        } catch (error) {
            console.error('Find reseller by code error:', error);
            throw error;
        }
    }

    // Get all resellers with pagination
    static async getAll(options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                status = null,
                level = null,
                search = null
            } = options;

            const offset = (page - 1) * limit;

            let query = supabase
                .from('resellers')
                .select(`
                    *,
                    users!inner(full_name, email, phone, created_at)
                `, { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            // Apply filters
            if (status) {
                query = query.eq('status', status);
            }

            if (level) {
                query = query.eq('level', level);
            }

            if (search) {
                query = query.or(`business_name.ilike.%${search}%,reseller_code.ilike.%${search}%`);
            }

            const { data, error, count } = await query;

            if (error) {
                throw error;
            }

            return {
                resellers: data.map(resellerData => new Reseller(resellerData)),
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            };

        } catch (error) {
            console.error('Get all resellers error:', error);
            throw error;
        }
    }

    // Update reseller
    async update(updateData) {
        try {
            const { data, error } = await supabase
                .from('resellers')
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
            console.error('Update reseller error:', error);
            throw error;
        }
    }

    // Approve reseller application
    async approve() {
        try {
            const updateData = {
                status: Reseller.STATUSES.APPROVED,
                approved_at: new Date().toISOString(),
                // Set default discounts for new approved reseller
                airtime_discount: this.airtime_discount || 2.0,
                data_discount: this.data_discount || 2.5,
                cable_discount: this.cable_discount || 1.5,
                electricity_discount: this.electricity_discount || 1.0,
                airtime_commission: this.airtime_commission || 1.0,
                data_commission: this.data_commission || 1.5,
                cable_commission: this.cable_commission || 1.0,
                electricity_commission: this.electricity_commission || 0.5
            };

            const updatedReseller = await this.update(updateData);

            // Update user role to reseller
            await supabase
                .from('users')
                .update({ role: 'reseller' })
                .eq('id', this.user_id);

            return updatedReseller;

        } catch (error) {
            console.error('Approve reseller error:', error);
            throw error;
        }
    }

    // Reject reseller application
    async reject(reason = 'Application requirements not met') {
        try {
            const updateData = {
                status: Reseller.STATUSES.REJECTED,
                rejection_reason: reason,
                rejected_at: new Date().toISOString()
            };

            return await this.update(updateData);

        } catch (error) {
            console.error('Reject reseller error:', error);
            throw error;
        }
    }

    // Suspend reseller
    async suspend(reason = 'Administrative action') {
        try {
            const updateData = {
                status: Reseller.STATUSES.SUSPENDED,
                suspension_reason: reason,
                suspended_at: new Date().toISOString()
            };

            const updatedReseller = await this.update(updateData);

            // Update user role back to user
            await supabase
                .from('users')
                .update({ role: 'user' })
                .eq('id', this.user_id);

            return updatedReseller;

        } catch (error) {
            console.error('Suspend reseller error:', error);
            throw error;
        }
    }

    // Reactivate reseller
    async reactivate() {
        try {
            const updateData = {
                status: Reseller.STATUSES.APPROVED,
                suspension_reason: null,
                suspended_at: null
            };

            const updatedReseller = await this.update(updateData);

            // Update user role back to reseller
            await supabase
                .from('users')
                .update({ role: 'reseller' })
                .eq('id', this.user_id);

            return updatedReseller;

        } catch (error) {
            console.error('Reactivate reseller error:', error);
            throw error;
        }
    }

    // Upgrade reseller level
    async upgradeLevel(newLevel) {
        try {
            if (!Object.values(Reseller.LEVELS).includes(newLevel)) {
                throw new Error('Invalid reseller level');
            }

            // Define discount/commission rates by level
            const levelRates = {
                [Reseller.LEVELS.BASIC]: {
                    airtime_discount: 2.0, data_discount: 2.5, cable_discount: 1.5, electricity_discount: 1.0,
                    airtime_commission: 1.0, data_commission: 1.5, cable_commission: 1.0, electricity_commission: 0.5
                },
                [Reseller.LEVELS.SILVER]: {
                    airtime_discount: 3.0, data_discount: 3.5, cable_discount: 2.0, electricity_discount: 1.5,
                    airtime_commission: 1.5, data_commission: 2.0, cable_commission: 1.5, electricity_commission: 1.0
                },
                [Reseller.LEVELS.GOLD]: {
                    airtime_discount: 4.0, data_discount: 4.5, cable_discount: 3.0, electricity_discount: 2.0,
                    airtime_commission: 2.0, data_commission: 2.5, cable_commission: 2.0, electricity_commission: 1.5
                },
                [Reseller.LEVELS.PLATINUM]: {
                    airtime_discount: 5.0, data_discount: 5.5, cable_discount: 4.0, electricity_discount: 3.0,
                    airtime_commission: 3.0, data_commission: 3.5, cable_commission: 3.0, electricity_commission: 2.0
                }
            };

            const newRates = levelRates[newLevel];
            const updateData = {
                level: newLevel,
                upgraded_at: new Date().toISOString(),
                ...newRates
            };

            return await this.update(updateData);

        } catch (error) {
            console.error('Upgrade reseller level error:', error);
            throw error;
        }
    }

    // Get sub-resellers
    async getSubResellers(options = {}) {
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
                    users!inner(full_name, email, phone, created_at)
                `, { count: 'exact' })
                .eq('reseller_id', this.user_id)
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
                sub_resellers: data,
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            };

        } catch (error) {
            console.error('Get sub-resellers error:', error);
            throw error;
        }
    }

    // Get reseller statistics
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
                .from('commissions')
                .select('amount')
                .eq('reseller_id', this.user_id)
                .gte('created_at', startDate.toISOString());

            if (commissionError) {
                console.error('Commission stats error:', commissionError);
            }

            // Get sub-reseller count
            const { count: subResellerCount, error: subResellerError } = await supabase
                .from('sub_resellers')
                .select('id', { count: 'exact' })
                .eq('reseller_id', this.user_id)
                .eq('status', 'active');

            if (subResellerError) {
                console.error('Sub-reseller count error:', subResellerError);
            }

            // Calculate statistics
            const stats = {
                period_days: period,
                total_sales: 0,
                successful_transactions: 0,
                failed_transactions: 0,
                total_commission: 0,
                sub_resellers: subResellerCount || 0,
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
            console.error('Get reseller statistics error:', error);
            throw error;
        }
    }

    // Check if reseller is active
    isActive() {
        return this.status === Reseller.STATUSES.APPROVED;
    }

    // Check if reseller is pending
    isPending() {
        return this.status === Reseller.STATUSES.PENDING;
    }

    // Check if reseller is suspended
    isSuspended() {
        return this.status === Reseller.STATUSES.SUSPENDED;
    }

    // Get discount for service type
    getDiscount(serviceType) {
        const discountMap = {
            airtime: this.airtime_discount,
            data: this.data_discount,
            cable: this.cable_discount,
            electricity: this.electricity_discount
        };

        return discountMap[serviceType] || 0;
    }

    // Get commission for service type
    getCommission(serviceType) {
        const commissionMap = {
            airtime: this.airtime_commission,
            data: this.data_commission,
            cable: this.cable_commission,
            electricity: this.electricity_commission
        };

        return commissionMap[serviceType] || 0;
    }

    // Convert to JSON
    toJSON() {
        return {
            id: this.id,
            user_id: this.user_id,
            business_name: this.business_name,
            business_address: this.business_address,
            business_phone: this.business_phone,
            website: this.website,
            expected_monthly_volume: this.expected_monthly_volume,
            reseller_code: this.reseller_code,
            status: this.status,
            level: this.level,
            airtime_discount: this.airtime_discount,
            data_discount: this.data_discount,
            cable_discount: this.cable_discount,
            electricity_discount: this.electricity_discount,
            airtime_commission: this.airtime_commission,
            data_commission: this.data_commission,
            cable_commission: this.cable_commission,
            electricity_commission: this.electricity_commission,
            applied_at: this.applied_at,
            approved_at: this.approved_at,
            upgraded_at: this.upgraded_at,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
}

module.exports = Reseller;
