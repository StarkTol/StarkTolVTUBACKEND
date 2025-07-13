const { supabase } = require('../config/supabase');
const { generateResponse } = require('../utils/helpers');
const { referralService } = require('../services/referralService');

class ReferralController {
    // Get user's referral information
    async getReferralInfo(req, res) {
        try {
            const userId = req.user.id;

            // Get user's referral code
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('referral_code')
                .eq('id', userId)
                .single();

            if (userError || !userData) {
                return res.status(404).json(generateResponse(false, 'User not found'));
            }

            // Get referral statistics
            const stats = await referralService.getReferralStats(userId);

            // Get recent referrals
            const { data: recentReferrals, error: referralsError } = await supabase
                .from('referrals')
                .select(`
                    id,
                    bonus_amount,
                    status,
                    created_at,
                    users!referrals_referred_id_fkey(full_name, email)
                `)
                .eq('referrer_id', userId)
                .order('created_at', { ascending: false })
                .limit(10);

            if (referralsError) {
                console.error('Recent referrals error:', referralsError);
            }

            const referralInfo = {
                referral_code: userData.referral_code,
                referral_link: `${process.env.FRONTEND_URL}/register?ref=${userData.referral_code}`,
                statistics: stats,
                recent_referrals: recentReferrals || []
            };

            res.json(generateResponse(true, 'Referral information retrieved successfully', referralInfo));

        } catch (error) {
            console.error('Get referral info error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get all referrals with pagination
    async getReferrals(req, res) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 20, status } = req.query;

            // Build query
            let query = supabase
                .from('referrals')
                .select(`
                    *,
                    users!referrals_referred_id_fkey(full_name, email, phone, created_at)
                `, { count: 'exact' })
                .eq('referrer_id', userId)
                .order('created_at', { ascending: false });

            // Apply status filter
            if (status) {
                query = query.eq('status', status);
            }

            // Apply pagination
            const offset = (parseInt(page) - 1) * parseInt(limit);
            query = query.range(offset, offset + parseInt(limit) - 1);

            const { data: referrals, error, count } = await query;

            if (error) {
                return res.status(500).json(generateResponse(false, 'Failed to retrieve referrals'));
            }

            const totalPages = Math.ceil(count / parseInt(limit));

            res.json(generateResponse(true, 'Referrals retrieved successfully', {
                referrals,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: totalPages,
                    total_records: count,
                    per_page: parseInt(limit)
                }
            }));

        } catch (error) {
            console.error('Get referrals error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get referral earnings
    async getReferralEarnings(req, res) {
        try {
            const userId = req.user.id;
            const { start_date, end_date, page = 1, limit = 20 } = req.query;

            // Build query for referral earnings
            let query = supabase
                .from('referral_earnings')
                .select(`
                    *,
                    referrals!inner(
                        users!referrals_referred_id_fkey(full_name, email)
                    ),
                    transactions!inner(type, description, created_at)
                `, { count: 'exact' })
                .eq('referrer_id', userId)
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

            const { data: earnings, error, count } = await query;

            if (error) {
                return res.status(500).json(generateResponse(false, 'Failed to retrieve referral earnings'));
            }

            // Calculate total earnings for the period
            let totalQuery = supabase
                .from('referral_earnings')
                .select('amount')
                .eq('referrer_id', userId);

            if (start_date) {
                totalQuery = totalQuery.gte('created_at', start_date);
            }

            if (end_date) {
                totalQuery = totalQuery.lte('created_at', end_date);
            }

            const { data: totalEarnings } = await totalQuery;
            const totalAmount = totalEarnings ? totalEarnings.reduce((sum, e) => sum + parseFloat(e.amount), 0) : 0;

            const totalPages = Math.ceil(count / parseInt(limit));

            res.json(generateResponse(true, 'Referral earnings retrieved successfully', {
                earnings,
                total_amount: totalAmount,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: totalPages,
                    total_records: count,
                    per_page: parseInt(limit)
                }
            }));

        } catch (error) {
            console.error('Get referral earnings error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Generate new referral code
    async generateNewReferralCode(req, res) {
        try {
            const userId = req.user.id;

            // Generate new unique referral code
            let newReferralCode;
            let isUnique = false;
            let attempts = 0;

            while (!isUnique && attempts < 10) {
                newReferralCode = `STK${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
                
                const { data: existingCode } = await supabase
                    .from('users')
                    .select('id')
                    .eq('referral_code', newReferralCode)
                    .single();

                if (!existingCode) {
                    isUnique = true;
                } else {
                    attempts++;
                }
            }

            if (!isUnique) {
                return res.status(500).json(generateResponse(false, 'Failed to generate unique referral code'));
            }

            // Update user's referral code
            const { error } = await supabase
                .from('users')
                .update({
                    referral_code: newReferralCode,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (error) {
                return res.status(500).json(generateResponse(false, 'Failed to update referral code'));
            }

            res.json(generateResponse(true, 'New referral code generated successfully', {
                referral_code: newReferralCode,
                referral_link: `${process.env.FRONTEND_URL}/register?ref=${newReferralCode}`
            }));

        } catch (error) {
            console.error('Generate new referral code error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Process referral bonus (when referred user makes first transaction)
    async processReferralBonus(req, res) {
        try {
            const { transaction_id } = req.body;

            if (!transaction_id) {
                return res.status(400).json(generateResponse(false, 'Transaction ID is required'));
            }

            // This endpoint would typically be called internally when a referred user completes their first transaction
            // For security, you might want to add additional authentication or make this an internal service call

            const result = await referralService.processReferralBonus(transaction_id);

            if (result.success) {
                res.json(generateResponse(true, 'Referral bonus processed successfully', result.data));
            } else {
                res.status(400).json(generateResponse(false, result.message));
            }

        } catch (error) {
            console.error('Process referral bonus error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get referral leaderboard
    async getReferralLeaderboard(req, res) {
        try {
            const { period = '30', limit = 10 } = req.query; // period in days

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(period));

            // Get top referrers for the period
            const { data: leaderboard, error } = await supabase
                .from('referrals')
                .select(`
                    referrer_id,
                    users!referrals_referrer_id_fkey(full_name, referral_code)
                `)
                .eq('status', 'approved')
                .gte('created_at', startDate.toISOString());

            if (error) {
                return res.status(500).json(generateResponse(false, 'Failed to retrieve referral leaderboard'));
            }

            // Count referrals per user
            const referralCounts = {};
            leaderboard.forEach(referral => {
                const referrerId = referral.referrer_id;
                if (!referralCounts[referrerId]) {
                    referralCounts[referrerId] = {
                        referrer_id: referrerId,
                        full_name: referral.users.full_name,
                        referral_code: referral.users.referral_code,
                        total_referrals: 0
                    };
                }
                referralCounts[referrerId].total_referrals++;
            });

            // Sort by total referrals and limit results
            const sortedLeaderboard = Object.values(referralCounts)
                .sort((a, b) => b.total_referrals - a.total_referrals)
                .slice(0, parseInt(limit));

            res.json(generateResponse(true, 'Referral leaderboard retrieved successfully', {
                leaderboard: sortedLeaderboard,
                period_days: parseInt(period)
            }));

        } catch (error) {
            console.error('Get referral leaderboard error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Withdraw referral earnings
    async withdrawReferralEarnings(req, res) {
        try {
            const userId = req.user.id;
            const { amount } = req.body;

            if (!amount || amount <= 0) {
                return res.status(400).json(generateResponse(false, 'Invalid withdrawal amount'));
            }

            // Check available referral earnings
            const { data: availableEarnings, error: earningsError } = await supabase
                .from('referral_earnings')
                .select('amount')
                .eq('referrer_id', userId)
                .eq('status', 'available');

            if (earningsError) {
                return res.status(500).json(generateResponse(false, 'Failed to check available earnings'));
            }

            const totalAvailable = availableEarnings.reduce((sum, e) => sum + parseFloat(e.amount), 0);
            const withdrawalAmount = parseFloat(amount);

            if (totalAvailable < withdrawalAmount) {
                return res.status(400).json(generateResponse(false, 'Insufficient referral earnings'));
            }

            const minWithdrawal = parseFloat(process.env.MIN_REFERRAL_WITHDRAWAL || '500');
            if (withdrawalAmount < minWithdrawal) {
                return res.status(400).json(generateResponse(false, `Minimum withdrawal amount is ₦${minWithdrawal}`));
            }

            // Get user's wallet
            const { data: walletData, error: walletError } = await supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', userId)
                .single();

            if (walletError || !walletData) {
                return res.status(404).json(generateResponse(false, 'Wallet not found'));
            }

            const newBalance = parseFloat(walletData.balance) + withdrawalAmount;

            // Update wallet balance
            const { error: updateWalletError } = await supabase
                .from('wallets')
                .update({
                    balance: newBalance,
                    total_deposits: parseFloat(walletData.total_deposits || 0) + withdrawalAmount,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (updateWalletError) {
                return res.status(500).json(generateResponse(false, 'Failed to update wallet balance'));
            }

            // Mark earnings as withdrawn (you'd need to implement logic to mark specific earnings)
            // For simplicity, we'll create a withdrawal transaction
            const { data: transactionData, error: transactionError } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'referral_withdrawal',
                    amount: withdrawalAmount,
                    description: 'Referral earnings withdrawal',
                    status: 'completed',
                    payment_reference: `REF${Date.now()}`,
                    balance_before: parseFloat(walletData.balance),
                    balance_after: newBalance
                })
                .select()
                .single();

            if (transactionError) {
                console.error('Transaction record error:', transactionError);
            }

            res.json(generateResponse(true, 'Referral earnings withdrawn successfully', {
                withdrawn_amount: withdrawalAmount,
                new_wallet_balance: newBalance,
                transaction: transactionData
            }));

        } catch (error) {
            console.error('Withdraw referral earnings error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }
}

module.exports = new ReferralController();
