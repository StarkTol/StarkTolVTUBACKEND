const { supabase } = require('../config/supabase');
const { generateResponse } = require('../utils/helpers');

class TransactionController {
    // Get user transactions with pagination
    async getTransactions(req, res) {
        try {
            const userId = req.user.id;
            const { 
                page = 1, 
                limit = 20, 
                type, 
                status, 
                start_date, 
                end_date 
            } = req.query;

            // Build query
            let query = supabase
                .from('transactions')
                .select('*', { count: 'exact' })
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            // Apply filters
            if (type) {
                query = query.eq('type', type);
            }

            if (status) {
                query = query.eq('status', status);
            }

            if (start_date) {
                query = query.gte('created_at', start_date);
            }

            if (end_date) {
                query = query.lte('created_at', end_date);
            }

            // Apply pagination
            const offset = (parseInt(page) - 1) * parseInt(limit);
            query = query.range(offset, offset + parseInt(limit) - 1);

            const { data: transactions, error, count } = await query;

            if (error) {
                return res.status(500).json(generateResponse(false, 'Failed to retrieve transactions'));
            }

            const totalPages = Math.ceil(count / parseInt(limit));

            res.json(generateResponse(true, 'Transactions retrieved successfully', {
                transactions,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: totalPages,
                    total_records: count,
                    per_page: parseInt(limit)
                }
            }));

        } catch (error) {
            console.error('Get transactions error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get transaction by ID
    async getTransaction(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            if (!id) {
                return res.status(400).json(generateResponse(false, 'Transaction ID is required'));
            }

            const { data: transaction, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('id', id)
                .eq('user_id', userId)
                .single();

            if (error || !transaction) {
                return res.status(404).json(generateResponse(false, 'Transaction not found'));
            }

            res.json(generateResponse(true, 'Transaction retrieved successfully', transaction));

        } catch (error) {
            console.error('Get transaction error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get transaction statistics
    async getTransactionStats(req, res) {
        try {
            const userId = req.user.id;
            const { period = '30' } = req.query; // days

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(period));

            // Get transaction counts by type
            const { data: transactionCounts, error: countsError } = await supabase
                .from('transactions')
                .select('type, status')
                .eq('user_id', userId)
                .gte('created_at', startDate.toISOString());

            if (countsError) {
                return res.status(500).json(generateResponse(false, 'Failed to retrieve transaction statistics'));
            }

            // Process statistics
            const stats = {
                total_transactions: transactionCounts.length,
                successful_transactions: transactionCounts.filter(t => t.status === 'completed').length,
                failed_transactions: transactionCounts.filter(t => t.status === 'failed').length,
                pending_transactions: transactionCounts.filter(t => t.status === 'pending' || t.status === 'processing').length,
                by_type: {}
            };

            // Count by type
            const typeCounts = {};
            transactionCounts.forEach(transaction => {
                if (!typeCounts[transaction.type]) {
                    typeCounts[transaction.type] = { total: 0, completed: 0, failed: 0, pending: 0 };
                }
                typeCounts[transaction.type].total++;
                if (transaction.status === 'completed') {
                    typeCounts[transaction.type].completed++;
                } else if (transaction.status === 'failed') {
                    typeCounts[transaction.type].failed++;
                } else if (transaction.status === 'pending' || transaction.status === 'processing') {
                    typeCounts[transaction.type].pending++;
                }
            });

            stats.by_type = typeCounts;

            // Get spending summary
            const { data: spendingData, error: spendingError } = await supabase
                .from('transactions')
                .select('amount, type')
                .eq('user_id', userId)
                .eq('status', 'completed')
                .gte('created_at', startDate.toISOString());

            if (!spendingError && spendingData) {
                stats.total_spent = spendingData
                    .filter(t => ['airtime_purchase', 'data_purchase', 'cable_purchase', 'electricity_purchase', 'transfer_out', 'withdrawal'].includes(t.type))
                    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

                stats.total_received = spendingData
                    .filter(t => ['deposit', 'transfer_in'].includes(t.type))
                    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
            }

            res.json(generateResponse(true, 'Transaction statistics retrieved successfully', stats));

        } catch (error) {
            console.error('Get transaction stats error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Download transaction receipt
    async downloadReceipt(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            if (!id) {
                return res.status(400).json(generateResponse(false, 'Transaction ID is required'));
            }

            const { data: transaction, error } = await supabase
                .from('transactions')
                .select(`
                    *,
                    users!inner(full_name, email, phone)
                `)
                .eq('id', id)
                .eq('user_id', userId)
                .eq('status', 'completed')
                .single();

            if (error || !transaction) {
                return res.status(404).json(generateResponse(false, 'Transaction not found or not completed'));
            }

            // Generate receipt data
            const receipt = {
                transaction_id: transaction.id,
                reference: transaction.payment_reference || `STK${Date.now()}`,
                date: transaction.created_at,
                customer: {
                    name: transaction.users.full_name,
                    email: transaction.users.email,
                    phone: transaction.users.phone
                },
                service: {
                    type: transaction.type,
                    description: transaction.description,
                    amount: transaction.amount
                },
                metadata: transaction.metadata,
                status: transaction.status
            };

            res.json(generateResponse(true, 'Receipt generated successfully', receipt));

        } catch (error) {
            console.error('Download receipt error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Retry failed transaction
    async retryTransaction(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            if (!id) {
                return res.status(400).json(generateResponse(false, 'Transaction ID is required'));
            }

            const { data: transaction, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('id', id)
                .eq('user_id', userId)
                .eq('status', 'failed')
                .single();

            if (error || !transaction) {
                return res.status(404).json(generateResponse(false, 'Failed transaction not found'));
            }

            // Check if transaction type supports retry
            const retryableTypes = ['airtime_purchase', 'data_purchase', 'cable_purchase', 'electricity_purchase'];
            if (!retryableTypes.includes(transaction.type)) {
                return res.status(400).json(generateResponse(false, 'This transaction type cannot be retried'));
            }

            // Check wallet balance
            const { data: walletData, error: walletError } = await supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', userId)
                .single();

            if (walletError || !walletData) {
                return res.status(404).json(generateResponse(false, 'Wallet not found'));
            }

            const currentBalance = parseFloat(walletData.balance);
            const requiredAmount = parseFloat(transaction.amount);

            if (currentBalance < requiredAmount) {
                return res.status(400).json(generateResponse(false, 'Insufficient wallet balance to retry transaction'));
            }

            // Update transaction status to processing
            const { error: updateError } = await supabase
                .from('transactions')
                .update({
                    status: 'processing',
                    error_message: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (updateError) {
                return res.status(500).json(generateResponse(false, 'Failed to update transaction status'));
            }

            res.json(generateResponse(true, 'Transaction retry initiated', {
                transaction_id: id,
                status: 'processing',
                message: 'Your transaction is being processed. You will receive an update shortly.'
            }));

            // Note: In a real implementation, you would trigger the actual retry process here
            // This could involve calling the VTU service again with the original transaction parameters

        } catch (error) {
            console.error('Retry transaction error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get recent transactions for dashboard
    async getRecentTransactions(req, res) {
        try {
            const userId = req.user.id;
            const { limit = 5 } = req.query;

            const { data: transactions, error } = await supabase
                .from('transactions')
                .select('id, type, amount, description, status, created_at, payment_reference')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(parseInt(limit));

            if (error) {
                return res.status(500).json(generateResponse(false, 'Failed to retrieve recent transactions'));
            }

            res.json(generateResponse(true, 'Recent transactions retrieved successfully', transactions));

        } catch (error) {
            console.error('Get recent transactions error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }
}

module.exports = new TransactionController();
