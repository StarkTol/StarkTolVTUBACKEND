const { supabase } = require('../config/supabase');
const { walletService } = require('./walletService');

class ReferralService {
    // Get referral statistics for a user
    async getReferralStats(userId) {
        try {
            // Get referral counts
            const { data: referrals, error: referralError } = await supabase
                .from('referrals')
                .select('status, bonus_amount, created_at')
                .eq('referrer_id', userId);

            if (referralError) {
                console.error('Referral stats error:', referralError);
            }

            // Get referral earnings
            const { data: earnings, error: earningsError } = await supabase
                .from('referral_earnings')
                .select('amount, status, created_at')
                .eq('referrer_id', userId);

            if (earningsError) {
                console.error('Referral earnings error:', earningsError);
            }

            // Calculate statistics
            const stats = {
                total_referrals: referrals ? referrals.length : 0,
                pending_referrals: referrals ? referrals.filter(r => r.status === 'pending').length : 0,
                approved_referrals: referrals ? referrals.filter(r => r.status === 'approved').length : 0,
                rejected_referrals: referrals ? referrals.filter(r => r.status === 'rejected').length : 0,
                total_bonus_earned: referrals ? referrals
                    .filter(r => r.status === 'approved')
                    .reduce((sum, r) => sum + parseFloat(r.bonus_amount), 0) : 0,
                total_commission_earned: earnings ? earnings
                    .filter(e => e.status === 'paid')
                    .reduce((sum, e) => sum + parseFloat(e.amount), 0) : 0,
                pending_commission: earnings ? earnings
                    .filter(e => e.status === 'pending')
                    .reduce((sum, e) => sum + parseFloat(e.amount), 0) : 0
            };

            return stats;

        } catch (error) {
            console.error('Get referral stats error:', error);
            throw new Error('Failed to retrieve referral statistics');
        }
    }

    // Process referral bonus when referred user completes first transaction
    async processReferralBonus(transactionId) {
        try {
            // Get transaction details
            const { data: transaction, error: transactionError } = await supabase
                .from('transactions')
                .select('user_id, amount, type, status')
                .eq('id', transactionId)
                .single();

            if (transactionError || !transaction) {
                return { success: false, message: 'Transaction not found' };
            }

            if (transaction.status !== 'completed') {
                return { success: false, message: 'Transaction not completed' };
            }

            // Check if this is user's first successful transaction
            const { data: previousTransactions, error: prevError } = await supabase
                .from('transactions')
                .select('id')
                .eq('user_id', transaction.user_id)
                .eq('status', 'completed')
                .in('type', ['airtime_purchase', 'data_purchase', 'cable_purchase', 'electricity_purchase'])
                .neq('id', transactionId);

            if (prevError) {
                console.error('Previous transactions check error:', prevError);
                return { success: false, message: 'Failed to check transaction history' };
            }

            if (previousTransactions && previousTransactions.length > 0) {
                return { success: false, message: 'Not user\'s first transaction' };
            }

            // Get user's referral information
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('referred_by')
                .eq('id', transaction.user_id)
                .single();

            if (userError || !userData || !userData.referred_by) {
                return { success: false, message: 'User was not referred' };
            }

            // Check if referral bonus already processed
            const { data: existingBonus, error: bonusError } = await supabase
                .from('referrals')
                .select('id')
                .eq('referrer_id', userData.referred_by)
                .eq('referred_id', transaction.user_id)
                .eq('status', 'approved')
                .single();

            if (bonusError && bonusError.code !== 'PGRST116') {
                console.error('Existing bonus check error:', bonusError);
            }

            if (existingBonus) {
                return { success: false, message: 'Referral bonus already processed' };
            }

            // Get referral bonus amount from settings
            const referralBonus = parseFloat(process.env.REFERRAL_BONUS || '100');
            const commissionPercentage = parseFloat(process.env.REFERRAL_COMMISSION_PERCENTAGE || '1');

            // Update referral status to approved
            const { error: updateError } = await supabase
                .from('referrals')
                .update({
                    status: 'approved',
                    approved_at: new Date().toISOString(),
                    bonus_amount: referralBonus
                })
                .eq('referrer_id', userData.referred_by)
                .eq('referred_id', transaction.user_id);

            if (updateError) {
                console.error('Update referral error:', updateError);
                return { success: false, message: 'Failed to update referral status' };
            }

            // Credit referrer's wallet with bonus
            try {
                await walletService.creditWallet(
                    userData.referred_by,
                    referralBonus,
                    `Referral bonus for user ${transaction.user_id}`,
                    `REF_BONUS_${Date.now()}`
                );
            } catch (walletError) {
                console.error('Wallet credit error:', walletError);
                // Revert referral status
                await supabase
                    .from('referrals')
                    .update({ status: 'pending' })
                    .eq('referrer_id', userData.referred_by)
                    .eq('referred_id', transaction.user_id);

                return { success: false, message: 'Failed to credit referral bonus' };
            }

            // Create referral earning record for ongoing commissions
            const { error: earningError } = await supabase
                .from('referral_earnings')
                .insert({
                    referrer_id: userData.referred_by,
                    referred_id: transaction.user_id,
                    transaction_id: transactionId,
                    amount: (parseFloat(transaction.amount) * commissionPercentage) / 100,
                    commission_percentage: commissionPercentage,
                    status: 'pending',
                    created_at: new Date().toISOString()
                });

            if (earningError) {
                console.error('Referral earning error:', earningError);
            }

            return {
                success: true,
                message: 'Referral bonus processed successfully',
                data: {
                    referrer_id: userData.referred_by,
                    referred_id: transaction.user_id,
                    bonus_amount: referralBonus,
                    commission_percentage: commissionPercentage
                }
            };

        } catch (error) {
            console.error('Process referral bonus error:', error);
            return { success: false, message: 'Internal server error' };
        }
    }

    // Process ongoing referral commissions
    async processReferralCommission(transactionId) {
        try {
            // Get transaction details
            const { data: transaction, error: transactionError } = await supabase
                .from('transactions')
                .select('user_id, amount, type, status')
                .eq('id', transactionId)
                .single();

            if (transactionError || !transaction) {
                return { success: false, message: 'Transaction not found' };
            }

            if (transaction.status !== 'completed') {
                return { success: false, message: 'Transaction not completed' };
            }

            // Check if user was referred
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('referred_by')
                .eq('id', transaction.user_id)
                .single();

            if (userError || !userData || !userData.referred_by) {
                return { success: false, message: 'User was not referred' };
            }

            // Check if referral is approved
            const { data: referralData, error: referralError } = await supabase
                .from('referrals')
                .select('status')
                .eq('referrer_id', userData.referred_by)
                .eq('referred_id', transaction.user_id)
                .single();

            if (referralError || !referralData || referralData.status !== 'approved') {
                return { success: false, message: 'Referral not approved' };
            }

            const commissionPercentage = parseFloat(process.env.REFERRAL_COMMISSION_PERCENTAGE || '1');
            const commissionAmount = (parseFloat(transaction.amount) * commissionPercentage) / 100;

            // Create referral earning record
            const { data: earningData, error: earningError } = await supabase
                .from('referral_earnings')
                .insert({
                    referrer_id: userData.referred_by,
                    referred_id: transaction.user_id,
                    transaction_id: transactionId,
                    amount: commissionAmount,
                    commission_percentage: commissionPercentage,
                    status: 'available',
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (earningError) {
                console.error('Referral earning error:', earningError);
                return { success: false, message: 'Failed to create referral earning' };
            }

            return {
                success: true,
                message: 'Referral commission processed successfully',
                data: earningData
            };

        } catch (error) {
            console.error('Process referral commission error:', error);
            return { success: false, message: 'Internal server error' };
        }
    }

    // Calculate lifetime referral value
    async calculateLifetimeValue(referrerId, referredId) {
        try {
            const { data: transactions, error } = await supabase
                .from('transactions')
                .select('amount')
                .eq('user_id', referredId)
                .eq('status', 'completed')
                .in('type', ['airtime_purchase', 'data_purchase', 'cable_purchase', 'electricity_purchase']);

            if (error) {
                throw error;
            }

            const totalValue = transactions ? transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0) : 0;
            const commissionPercentage = parseFloat(process.env.REFERRAL_COMMISSION_PERCENTAGE || '1');
            const totalCommission = (totalValue * commissionPercentage) / 100;

            return {
                total_transactions: transactions ? transactions.length : 0,
                total_value: totalValue,
                total_commission: totalCommission,
                commission_percentage: commissionPercentage
            };

        } catch (error) {
            console.error('Calculate lifetime value error:', error);
            throw new Error('Failed to calculate lifetime referral value');
        }
    }

    // Get referral performance metrics
    async getReferralPerformance(referrerId, period = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - period);

            // Get referrals within period
            const { data: referrals, error: referralError } = await supabase
                .from('referrals')
                .select(`
                    *,
                    users!referrals_referred_id_fkey(full_name, created_at)
                `)
                .eq('referrer_id', referrerId)
                .gte('created_at', startDate.toISOString());

            if (referralError) {
                throw referralError;
            }

            // Get earnings within period
            const { data: earnings, error: earningsError } = await supabase
                .from('referral_earnings')
                .select('amount, status')
                .eq('referrer_id', referrerId)
                .gte('created_at', startDate.toISOString());

            if (earningsError) {
                console.error('Earnings error:', earningsError);
            }

            const performance = {
                period_days: period,
                new_referrals: referrals ? referrals.length : 0,
                approved_referrals: referrals ? referrals.filter(r => r.status === 'approved').length : 0,
                total_earnings: earnings ? earnings.reduce((sum, e) => sum + parseFloat(e.amount), 0) : 0,
                available_earnings: earnings ? earnings
                    .filter(e => e.status === 'available')
                    .reduce((sum, e) => sum + parseFloat(e.amount), 0) : 0,
                conversion_rate: 0,
                top_referring_channels: []
            };

            if (performance.new_referrals > 0) {
                performance.conversion_rate = ((performance.approved_referrals / performance.new_referrals) * 100).toFixed(2);
            }

            return performance;

        } catch (error) {
            console.error('Get referral performance error:', error);
            throw new Error('Failed to retrieve referral performance');
        }
    }

    // Validate referral code
    async validateReferralCode(referralCode) {
        try {
            const { data: userData, error } = await supabase
                .from('users')
                .select('id, full_name, status')
                .eq('referral_code', referralCode)
                .single();

            if (error || !userData) {
                return { valid: false, message: 'Invalid referral code' };
            }

            if (userData.status !== 'active') {
                return { valid: false, message: 'Referrer account is not active' };
            }

            return {
                valid: true,
                referrer_id: userData.id,
                referrer_name: userData.full_name
            };

        } catch (error) {
            console.error('Validate referral code error:', error);
            return { valid: false, message: 'Failed to validate referral code' };
        }
    }

    // Get referral leaderboard
    async getReferralLeaderboard(period = 30, limit = 10) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - period);

            const { data: leaderboard, error } = await supabase
                .from('referrals')
                .select(`
                    referrer_id,
                    users!referrals_referrer_id_fkey(full_name, referral_code)
                `)
                .eq('status', 'approved')
                .gte('created_at', startDate.toISOString());

            if (error) {
                throw error;
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

            // Sort and limit
            const sortedLeaderboard = Object.values(referralCounts)
                .sort((a, b) => b.total_referrals - a.total_referrals)
                .slice(0, limit);

            return sortedLeaderboard;

        } catch (error) {
            console.error('Get referral leaderboard error:', error);
            throw new Error('Failed to retrieve referral leaderboard');
        }
    }

    // Set referral bonus amount
    async setReferralBonus(amount) {
        try {
            const { error } = await supabase
                .from('platform_settings')
                .upsert({
                    key: 'referral_bonus',
                    value: amount.toString(),
                    description: 'Bonus amount given for successful referrals',
                    updated_at: new Date().toISOString()
                });

            if (error) {
                throw error;
            }

            return { success: true, message: 'Referral bonus amount updated successfully' };

        } catch (error) {
            console.error('Set referral bonus error:', error);
            throw new Error('Failed to update referral bonus amount');
        }
    }
}

const referralService = new ReferralService();
module.exports = { referralService };
