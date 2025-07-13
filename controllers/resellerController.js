const { supabase, supabaseAdmin } = require('../config/supabase');
const { generateResponse } = require('../utils/helpers');
const { resellerService } = require('../services/resellerService');

class ResellerController {
    // Apply to become a reseller
    async applyForReseller(req, res) {
        try {
            const userId = req.user.id;
            const { business_name, business_address, business_phone, website, expected_monthly_volume } = req.body;

            // Validate input
            if (!business_name || !business_address || !business_phone) {
                return res.status(400).json(generateResponse(false, 'Business name, address, and phone are required'));
            }

            // Check if user already has reseller application or is already a reseller
            const { data: existingReseller } = await supabase
                .from('resellers')
                .select('id, status')
                .eq('user_id', userId)
                .single();

            if (existingReseller) {
                if (existingReseller.status === 'pending') {
                    return res.status(400).json(generateResponse(false, 'You already have a pending reseller application'));
                } else if (existingReseller.status === 'approved') {
                    return res.status(400).json(generateResponse(false, 'You are already an approved reseller'));
                }
            }

            // Check user account age and activity (minimum requirements)
            const { data: userData } = await supabase
                .from('users')
                .select('created_at')
                .eq('id', userId)
                .single();

            const accountAgeInDays = Math.floor((new Date() - new Date(userData.created_at)) / (1000 * 60 * 60 * 24));
            if (accountAgeInDays < 30) {
                return res.status(400).json(generateResponse(false, 'Account must be at least 30 days old to apply for reseller status'));
            }

            // Generate unique reseller code
            const resellerCode = `RSL${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

            // Create or update reseller application
            const { data: resellerData, error } = await supabase
                .from('resellers')
                .upsert({
                    user_id: userId,
                    business_name,
                    business_address,
                    business_phone,
                    website,
                    expected_monthly_volume: parseFloat(expected_monthly_volume || 0),
                    reseller_code: resellerCode,
                    status: 'pending',
                    applied_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                return res.status(500).json(generateResponse(false, 'Failed to submit reseller application'));
            }

            res.json(generateResponse(true, 'Reseller application submitted successfully', {
                application_id: resellerData.id,
                reseller_code: resellerCode,
                status: 'pending',
                message: 'Your application will be reviewed within 3-5 business days'
            }));

        } catch (error) {
            console.error('Apply for reseller error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get reseller dashboard data
    async getResellerDashboard(req, res) {
        try {
            const userId = req.user.id;

            // Check if user is a reseller
            const { data: resellerData, error: resellerError } = await supabase
                .from('resellers')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'approved')
                .single();

            if (resellerError || !resellerData) {
                return res.status(403).json(generateResponse(false, 'Access denied. You are not an approved reseller'));
            }

            // Get reseller statistics
            const stats = await resellerService.getResellerStats(userId);

            // Get recent transactions
            const { data: recentTransactions, error: transactionsError } = await supabase
                .from('transactions')
                .select('id, type, amount, description, status, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10);

            if (transactionsError) {
                console.error('Recent transactions error:', transactionsError);
            }

            // Get sub-resellers
            const { data: subResellers, error: subResellersError } = await supabase
                .from('sub_resellers')
                .select(`
                    id,
                    status,
                    created_at,
                    users!inner(full_name, email, phone)
                `)
                .eq('reseller_id', userId)
                .order('created_at', { ascending: false })
                .limit(5);

            if (subResellersError) {
                console.error('Sub-resellers error:', subResellersError);
            }

            const dashboardData = {
                reseller_info: resellerData,
                statistics: stats,
                recent_transactions: recentTransactions || [],
                sub_resellers: subResellers || []
            };

            res.json(generateResponse(true, 'Reseller dashboard data retrieved successfully', dashboardData));

        } catch (error) {
            console.error('Get reseller dashboard error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get reseller pricing/discounts
    async getResellerPricing(req, res) {
        try {
            const userId = req.user.id;

            // Check if user is a reseller
            const { data: resellerData, error } = await supabase
                .from('resellers')
                .select('airtime_discount, data_discount, cable_discount, electricity_discount')
                .eq('user_id', userId)
                .eq('status', 'approved')
                .single();

            if (error || !resellerData) {
                return res.status(403).json(generateResponse(false, 'Access denied. You are not an approved reseller'));
            }

            res.json(generateResponse(true, 'Reseller pricing retrieved successfully', resellerData));

        } catch (error) {
            console.error('Get reseller pricing error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Create sub-reseller
    async createSubReseller(req, res) {
        try {
            const resellerId = req.user.id;
            const { user_email, commission_percentage } = req.body;

            // Validate input
            if (!user_email || !commission_percentage) {
                return res.status(400).json(generateResponse(false, 'User email and commission percentage are required'));
            }

            if (commission_percentage < 0 || commission_percentage > 50) {
                return res.status(400).json(generateResponse(false, 'Commission percentage must be between 0 and 50'));
            }

            // Check if user is a reseller
            const { data: resellerData, error: resellerError } = await supabase
                .from('resellers')
                .select('*')
                .eq('user_id', resellerId)
                .eq('status', 'approved')
                .single();

            if (resellerError || !resellerData) {
                return res.status(403).json(generateResponse(false, 'Access denied. You are not an approved reseller'));
            }

            // Check if target user exists
            const { data: targetUser, error: userError } = await supabase
                .from('users')
                .select('id, full_name, email, role')
                .eq('email', user_email)
                .eq('status', 'active')
                .single();

            if (userError || !targetUser) {
                return res.status(404).json(generateResponse(false, 'User not found or inactive'));
            }

            if (targetUser.role !== 'user') {
                return res.status(400).json(generateResponse(false, 'User is already a reseller or has a special role'));
            }

            // Check if user is already a sub-reseller
            const { data: existingSubReseller } = await supabase
                .from('sub_resellers')
                .select('id')
                .eq('user_id', targetUser.id)
                .single();

            if (existingSubReseller) {
                return res.status(400).json(generateResponse(false, 'User is already a sub-reseller'));
            }

            // Generate sub-reseller code
            const subResellerCode = `SUB${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

            // Create sub-reseller record
            const { data: subResellerData, error: createError } = await supabase
                .from('sub_resellers')
                .insert({
                    user_id: targetUser.id,
                    reseller_id: resellerId,
                    sub_reseller_code: subResellerCode,
                    commission_percentage: parseFloat(commission_percentage),
                    status: 'active'
                })
                .select()
                .single();

            if (createError) {
                return res.status(500).json(generateResponse(false, 'Failed to create sub-reseller'));
            }

            // Update user role
            await supabase
                .from('users')
                .update({ role: 'sub_reseller' })
                .eq('id', targetUser.id);

            res.json(generateResponse(true, 'Sub-reseller created successfully', {
                sub_reseller: {
                    ...subResellerData,
                    user_name: targetUser.full_name,
                    user_email: targetUser.email
                }
            }));

        } catch (error) {
            console.error('Create sub-reseller error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get sub-resellers
    async getSubResellers(req, res) {
        try {
            const resellerId = req.user.id;
            const { page = 1, limit = 20 } = req.query;

            // Check if user is a reseller
            const { data: resellerData, error: resellerError } = await supabase
                .from('resellers')
                .select('id')
                .eq('user_id', resellerId)
                .eq('status', 'approved')
                .single();

            if (resellerError || !resellerData) {
                return res.status(403).json(generateResponse(false, 'Access denied. You are not an approved reseller'));
            }

            // Get sub-resellers with pagination
            const offset = (parseInt(page) - 1) * parseInt(limit);
            
            const { data: subResellers, error, count } = await supabase
                .from('sub_resellers')
                .select(`
                    *,
                    users!inner(full_name, email, phone, created_at, last_login)
                `, { count: 'exact' })
                .eq('reseller_id', resellerId)
                .order('created_at', { ascending: false })
                .range(offset, offset + parseInt(limit) - 1);

            if (error) {
                return res.status(500).json(generateResponse(false, 'Failed to retrieve sub-resellers'));
            }

            const totalPages = Math.ceil(count / parseInt(limit));

            res.json(generateResponse(true, 'Sub-resellers retrieved successfully', {
                sub_resellers: subResellers,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: totalPages,
                    total_records: count,
                    per_page: parseInt(limit)
                }
            }));

        } catch (error) {
            console.error('Get sub-resellers error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Update sub-reseller commission
    async updateSubResellerCommission(req, res) {
        try {
            const resellerId = req.user.id;
            const { sub_reseller_id } = req.params;
            const { commission_percentage } = req.body;

            if (!commission_percentage || commission_percentage < 0 || commission_percentage > 50) {
                return res.status(400).json(generateResponse(false, 'Commission percentage must be between 0 and 50'));
            }

            // Check if user is a reseller and owns this sub-reseller
            const { data: subResellerData, error } = await supabase
                .from('sub_resellers')
                .select('id, user_id')
                .eq('id', sub_reseller_id)
                .eq('reseller_id', resellerId)
                .single();

            if (error || !subResellerData) {
                return res.status(404).json(generateResponse(false, 'Sub-reseller not found'));
            }

            // Update commission
            const { error: updateError } = await supabase
                .from('sub_resellers')
                .update({
                    commission_percentage: parseFloat(commission_percentage),
                    updated_at: new Date().toISOString()
                })
                .eq('id', sub_reseller_id);

            if (updateError) {
                return res.status(500).json(generateResponse(false, 'Failed to update commission'));
            }

            res.json(generateResponse(true, 'Sub-reseller commission updated successfully'));

        } catch (error) {
            console.error('Update sub-reseller commission error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Deactivate sub-reseller
    async deactivateSubReseller(req, res) {
        try {
            const resellerId = req.user.id;
            const { sub_reseller_id } = req.params;

            // Check if user is a reseller and owns this sub-reseller
            const { data: subResellerData, error } = await supabase
                .from('sub_resellers')
                .select('id, user_id')
                .eq('id', sub_reseller_id)
                .eq('reseller_id', resellerId)
                .single();

            if (error || !subResellerData) {
                return res.status(404).json(generateResponse(false, 'Sub-reseller not found'));
            }

            // Update status
            const { error: updateError } = await supabase
                .from('sub_resellers')
                .update({
                    status: 'inactive',
                    updated_at: new Date().toISOString()
                })
                .eq('id', sub_reseller_id);

            if (updateError) {
                return res.status(500).json(generateResponse(false, 'Failed to deactivate sub-reseller'));
            }

            // Update user role back to user
            await supabase
                .from('users')
                .update({ role: 'user' })
                .eq('id', subResellerData.user_id);

            res.json(generateResponse(true, 'Sub-reseller deactivated successfully'));

        } catch (error) {
            console.error('Deactivate sub-reseller error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get commissions earned
    async getCommissions(req, res) {
        try {
            const userId = req.user.id;
            const { start_date, end_date, page = 1, limit = 20 } = req.query;

            // Build query for commissions
            let query = supabase
                .from('commissions')
                .select(`
                    *,
                    transactions!inner(type, description, created_at),
                    users!inner(full_name, email)
                `, { count: 'exact' })
                .eq('reseller_id', userId)
                .order('created_at', { ascending: false });

            // Apply date filters
            if (start_date) {
                query = query.gte('created_at', start_date);
            }

            if (end_date) {
                query = query.lte('created_at', end_date);
            }

            // Apply pagination
            const offset = (parseInt(page) - 1) * parseInt(limit);
            query = query.range(offset, offset + parseInt(limit) - 1);

            const { data: commissions, error, count } = await query;

            if (error) {
                return res.status(500).json(generateResponse(false, 'Failed to retrieve commissions'));
            }

            // Calculate total commission for the period
            let totalQuery = supabase
                .from('commissions')
                .select('amount')
                .eq('reseller_id', userId);

            if (start_date) {
                totalQuery = totalQuery.gte('created_at', start_date);
            }

            if (end_date) {
                totalQuery = totalQuery.lte('created_at', end_date);
            }

            const { data: totalCommissions } = await totalQuery;
            const totalAmount = totalCommissions ? totalCommissions.reduce((sum, c) => sum + parseFloat(c.amount), 0) : 0;

            const totalPages = Math.ceil(count / parseInt(limit));

            res.json(generateResponse(true, 'Commissions retrieved successfully', {
                commissions,
                total_amount: totalAmount,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: totalPages,
                    total_records: count,
                    per_page: parseInt(limit)
                }
            }));

        } catch (error) {
            console.error('Get commissions error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }
}

module.exports = new ResellerController();
