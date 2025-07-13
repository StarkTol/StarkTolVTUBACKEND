const { supabase } = require('../config/supabase');

class User {
    constructor(data = {}) {
        this.id = data.id || null;
        this.email = data.email || '';
        this.full_name = data.full_name || '';
        this.phone = data.phone || '';
        this.role = data.role || 'user';
        this.status = data.status || 'active';
        this.referral_code = data.referral_code || '';
        this.referred_by = data.referred_by || null;
        this.wallet_balance = data.wallet_balance || 0.00;
        this.email_verified_at = data.email_verified_at || null;
        this.phone_verified_at = data.phone_verified_at || null;
        this.last_login = data.last_login || null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    // Create new user
    static async create(userData) {
        try {
            const { data, error } = await supabase
                .from('users')
                .insert(userData)
                .select()
                .single();

            if (error) {
                throw error;
            }

            return new User(data);
        } catch (error) {
            console.error('Create user error:', error);
            throw error;
        }
    }

    // Find user by ID
    static async findById(id) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // User not found
                }
                throw error;
            }

            return new User(data);
        } catch (error) {
            console.error('Find user by ID error:', error);
            throw error;
        }
    }

    // Find user by email
    static async findByEmail(email) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email.toLowerCase())
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // User not found
                }
                throw error;
            }

            return new User(data);
        } catch (error) {
            console.error('Find user by email error:', error);
            throw error;
        }
    }

    // Find user by phone
    static async findByPhone(phone) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('phone', phone)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // User not found
                }
                throw error;
            }

            return new User(data);
        } catch (error) {
            console.error('Find user by phone error:', error);
            throw error;
        }
    }

    // Find user by referral code
    static async findByReferralCode(referralCode) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('referral_code', referralCode)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // User not found
                }
                throw error;
            }

            return new User(data);
        } catch (error) {
            console.error('Find user by referral code error:', error);
            throw error;
        }
    }

    // Get all users with pagination
    static async getAll(options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                role = null,
                status = null,
                search = null
            } = options;

            const offset = (page - 1) * limit;

            let query = supabase
                .from('users')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            // Apply filters
            if (role) {
                query = query.eq('role', role);
            }

            if (status) {
                query = query.eq('status', status);
            }

            if (search) {
                query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
            }

            const { data, error, count } = await query;

            if (error) {
                throw error;
            }

            return {
                users: data.map(userData => new User(userData)),
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            };

        } catch (error) {
            console.error('Get all users error:', error);
            throw error;
        }
    }

    // Update user
    async update(updateData) {
        try {
            const { data, error } = await supabase
                .from('users')
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
            console.error('Update user error:', error);
            throw error;
        }
    }

    // Delete user
    async delete() {
        try {
            const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', this.id);

            if (error) {
                throw error;
            }

            return true;

        } catch (error) {
            console.error('Delete user error:', error);
            throw error;
        }
    }

    // Get user's wallet
    async getWallet() {
        try {
            const { data, error } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', this.id)
                .single();

            if (error) {
                throw error;
            }

            return data;

        } catch (error) {
            console.error('Get user wallet error:', error);
            throw error;
        }
    }

    // Get user's transactions
    async getTransactions(options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                type = null,
                status = null
            } = options;

            const offset = (page - 1) * limit;

            let query = supabase
                .from('transactions')
                .select('*', { count: 'exact' })
                .eq('user_id', this.id)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (type) {
                query = query.eq('type', type);
            }

            if (status) {
                query = query.eq('status', status);
            }

            const { data, error, count } = await query;

            if (error) {
                throw error;
            }

            return {
                transactions: data,
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            };

        } catch (error) {
            console.error('Get user transactions error:', error);
            throw error;
        }
    }

    // Get user's referrals
    async getReferrals() {
        try {
            const { data, error } = await supabase
                .from('referrals')
                .select(`
                    *,
                    users!referrals_referred_id_fkey(full_name, email, created_at)
                `)
                .eq('referrer_id', this.id)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            return data || [];

        } catch (error) {
            console.error('Get user referrals error:', error);
            throw error;
        }
    }

    // Check if user is reseller
    async isReseller() {
        try {
            const { data, error } = await supabase
                .from('resellers')
                .select('status')
                .eq('user_id', this.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            return data && data.status === 'approved';

        } catch (error) {
            console.error('Check reseller status error:', error);
            return false;
        }
    }

    // Check if user is sub-reseller
    async isSubReseller() {
        try {
            const { data, error } = await supabase
                .from('sub_resellers')
                .select('status')
                .eq('user_id', this.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            return data && data.status === 'active';

        } catch (error) {
            console.error('Check sub-reseller status error:', error);
            return false;
        }
    }

    // Verify email
    async verifyEmail() {
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    email_verified_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.id);

            if (error) {
                throw error;
            }

            this.email_verified_at = new Date().toISOString();
            return true;

        } catch (error) {
            console.error('Verify email error:', error);
            throw error;
        }
    }

    // Verify phone
    async verifyPhone() {
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    phone_verified_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.id);

            if (error) {
                throw error;
            }

            this.phone_verified_at = new Date().toISOString();
            return true;

        } catch (error) {
            console.error('Verify phone error:', error);
            throw error;
        }
    }

    // Update last login
    async updateLastLogin() {
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    last_login: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.id);

            if (error) {
                throw error;
            }

            this.last_login = new Date().toISOString();
            return true;

        } catch (error) {
            console.error('Update last login error:', error);
            throw error;
        }
    }

    // Suspend user
    async suspend(reason = 'Administrative action') {
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    status: 'suspended',
                    suspension_reason: reason,
                    suspended_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.id);

            if (error) {
                throw error;
            }

            this.status = 'suspended';
            return true;

        } catch (error) {
            console.error('Suspend user error:', error);
            throw error;
        }
    }

    // Reactivate user
    async reactivate() {
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    status: 'active',
                    suspension_reason: null,
                    suspended_at: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.id);

            if (error) {
                throw error;
            }

            this.status = 'active';
            return true;

        } catch (error) {
            console.error('Reactivate user error:', error);
            throw error;
        }
    }

    // Convert to JSON (removing sensitive fields)
    toJSON() {
        const { ...userData } = this;
        return userData;
    }

    // Get display name
    getDisplayName() {
        return this.full_name || this.email;
    }

    // Check if user is active
    isActive() {
        return this.status === 'active';
    }

    // Check if email is verified
    isEmailVerified() {
        return !!this.email_verified_at;
    }

    // Check if phone is verified
    isPhoneVerified() {
        return !!this.phone_verified_at;
    }
}

module.exports = User;
