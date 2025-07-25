const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middlewares/authMiddleware');
const { generateResponse } = require('../utils/helpers');

// Middleware - require authentication for all stats routes
router.use(authMiddleware);

/**
 * GET /api/v1/stats/usage
 * Get user usage statistics
 */
router.get('/usage', async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get user's transaction statistics
        const { data: transactions, error: transactionError } = await supabase
            .from('transactions')
            .select('type, amount, created_at, status')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
            
        if (transactionError) {
            throw transactionError;
        }
        
        // Get wallet information
        const { data: wallet, error: walletError } = await supabase
            .from('wallets')
            .select('balance, total_deposits, total_withdrawals, created_at')
            .eq('user_id', userId)
            .single();
            
        if (walletError && walletError.code !== 'PGRST116') {
            throw walletError;
        }
        
        // Calculate usage statistics
        const stats = {
            wallet: {
                current_balance: wallet?.balance || 0,
                total_deposits: wallet?.total_deposits || 0,
                total_withdrawals: wallet?.total_withdrawals || 0,
                wallet_created: wallet?.created_at || null
            },
            transactions: {
                total_count: transactions?.length || 0,
                successful_count: transactions?.filter(t => t.status === 'successful')?.length || 0,
                pending_count: transactions?.filter(t => t.status === 'pending')?.length || 0,
                failed_count: transactions?.filter(t => t.status === 'failed')?.length || 0
            },
            activity: {
                last_30_days: transactions?.filter(t => {
                    const transactionDate = new Date(t.created_at);
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    return transactionDate >= thirtyDaysAgo;
                })?.length || 0,
                this_month: transactions?.filter(t => {
                    const transactionDate = new Date(t.created_at);
                    const currentMonth = new Date().getMonth();
                    const currentYear = new Date().getFullYear();
                    return transactionDate.getMonth() === currentMonth && 
                           transactionDate.getFullYear() === currentYear;
                })?.length || 0
            }
        };
        
        res.json(generateResponse(true, 'Usage statistics retrieved successfully', stats));
        
    } catch (error) {
        console.error('Stats usage error:', error);
        res.status(500).json(generateResponse(false, 'Failed to retrieve usage statistics', {
            error: error.message
        }));
    }
});

/**
 * GET /api/v1/stats/summary
 * Get summary statistics for dashboard
 */
router.get('/summary', async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get recent transactions (last 10)
        const { data: recentTransactions, error: recentError } = await supabase
            .from('transactions')
            .select('id, type, amount, description, status, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);
            
        if (recentError) {
            throw recentError;
        }
        
        // Get current wallet balance
        const { data: wallet, error: walletError } = await supabase
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .single();
            
        const currentBalance = wallet?.balance || 0;
        
        // Calculate quick stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayTransactions = recentTransactions?.filter(t => 
            new Date(t.created_at) >= today
        ) || [];
        
        const summary = {
            current_balance: currentBalance,
            today_transactions: todayTransactions.length,
            recent_transactions: recentTransactions || [],
            quick_stats: {
                total_spent_today: todayTransactions
                    .filter(t => t.type === 'debit')
                    .reduce((sum, t) => sum + parseFloat(t.amount), 0),
                total_funded_today: todayTransactions
                    .filter(t => t.type === 'credit')
                    .reduce((sum, t) => sum + parseFloat(t.amount), 0)
            }
        };
        
        res.json(generateResponse(true, 'Summary statistics retrieved successfully', summary));
        
    } catch (error) {
        console.error('Stats summary error:', error);
        res.status(500).json(generateResponse(false, 'Failed to retrieve summary statistics', {
            error: error.message
        }));
    }
});

module.exports = router;
