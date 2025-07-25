const { supabase } = require('../config/supabase');
const { realtimeHandler } = require('../utils/realtimeHandler');

class WalletService {
    // Check if a transaction reference has already been processed (idempotency)
    async isTransactionProcessed(transactionRef) {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('id')
                .eq('payment_reference', transactionRef)
                .single();
            if (error && error.code !== 'PGRST116') { // PGRST116: No rows found
                throw error;
            }
            return !!data;
        } catch (error) {
            console.error('isTransactionProcessed error:', error);
            return false;
        }
    }
    // Create wallet for new user
    async createWallet(userId) {
        try {
            const { data, error } = await supabase
                .from('wallets')
                .insert({
                    user_id: userId,
                    balance: 0.00,
                    total_deposits: 0.00,
                    total_withdrawals: 0.00,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Create wallet error:', error);
            throw new Error('Failed to create wallet');
        }
    }

    // Get wallet by user ID
    async getWallet(userId) {
        try {
            const { data, error } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Get wallet error:', error);
            throw new Error('Failed to retrieve wallet');
        }
    }

    // Credit wallet (add funds)
    async creditWallet(userId, amount, description = 'Wallet credit', transactionRef = null) {
        try {
            // Get current wallet balance
            const wallet = await this.getWallet(userId);
            const newBalance = parseFloat(wallet.balance) + parseFloat(amount);
            const newTotalDeposits = parseFloat(wallet.total_deposits) + parseFloat(amount);

            // Update wallet balance
            const { error: updateError } = await supabase
                .from('wallets')
                .update({
                    balance: newBalance,
                    total_deposits: newTotalDeposits,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (updateError) {
                throw updateError;
            }

            // Create transaction record
            const { data: transaction, error: transactionError } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'credit',
                    amount: parseFloat(amount),
                    description,
                    status: 'completed',
                    payment_reference: transactionRef || `CREDIT_${Date.now()}`,
                    balance_before: parseFloat(wallet.balance),
                    balance_after: newBalance,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (transactionError) {
                console.error('Transaction record error:', transactionError);
            }

            // Send real-time update
            realtimeHandler.sendBalanceUpdate(userId, newBalance);

            return {
                success: true,
                new_balance: newBalance,
                transaction
            };

        } catch (error) {
            console.error('Credit wallet error:', error);
            throw new Error('Failed to credit wallet');
        }
    }

    // Debit wallet (subtract funds)
    async debitWallet(userId, amount, description = 'Wallet debit', transactionRef = null) {
        try {
            // Get current wallet balance
            const wallet = await this.getWallet(userId);
            const currentBalance = parseFloat(wallet.balance);
            const debitAmount = parseFloat(amount);

            // Check sufficient balance
            if (currentBalance < debitAmount) {
                throw new Error('Insufficient wallet balance');
            }

            const newBalance = currentBalance - debitAmount;
            const newTotalWithdrawals = parseFloat(wallet.total_withdrawals) + debitAmount;

            // Update wallet balance
            const { error: updateError } = await supabase
                .from('wallets')
                .update({
                    balance: newBalance,
                    total_withdrawals: newTotalWithdrawals,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (updateError) {
                throw updateError;
            }

            // Create transaction record
            const { data: transaction, error: transactionError } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'debit',
                    amount: debitAmount,
                    description,
                    status: 'completed',
                    payment_reference: transactionRef || `DEBIT_${Date.now()}`,
                    balance_before: currentBalance,
                    balance_after: newBalance,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (transactionError) {
                console.error('Transaction record error:', transactionError);
            }

            // Send real-time update
            realtimeHandler.sendBalanceUpdate(userId, newBalance);

            return {
                success: true,
                new_balance: newBalance,
                transaction
            };

        } catch (error) {
            console.error('Debit wallet error:', error);
            throw error;
        }
    }

    // Transfer funds between wallets
    async transferFunds(fromUserId, toUserId, amount, description = 'Wallet transfer') {
        try {
            const transferAmount = parseFloat(amount);
            const transferRef = `TFR_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

            // Get both wallets
            const [fromWallet, toWallet] = await Promise.all([
                this.getWallet(fromUserId),
                this.getWallet(toUserId)
            ]);

            const fromCurrentBalance = parseFloat(fromWallet.balance);

            // Check sufficient balance
            if (fromCurrentBalance < transferAmount) {
                throw new Error('Insufficient wallet balance');
            }

            const fromNewBalance = fromCurrentBalance - transferAmount;
            const toNewBalance = parseFloat(toWallet.balance) + transferAmount;

            // Update both wallets
            const [fromUpdate, toUpdate] = await Promise.all([
                supabase
                    .from('wallets')
                    .update({
                        balance: fromNewBalance,
                        total_withdrawals: parseFloat(fromWallet.total_withdrawals) + transferAmount,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', fromUserId),
                
                supabase
                    .from('wallets')
                    .update({
                        balance: toNewBalance,
                        total_deposits: parseFloat(toWallet.total_deposits) + transferAmount,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', toUserId)
            ]);

            if (fromUpdate.error || toUpdate.error) {
                throw new Error('Failed to update wallets');
            }

            // Create transaction records for both users
            const [fromTransaction, toTransaction] = await Promise.all([
                supabase
                    .from('transactions')
                    .insert({
                        user_id: fromUserId,
                        type: 'transfer_out',
                        amount: transferAmount,
                        description: `${description} (to user ${toUserId})`,
                        status: 'completed',
                        payment_reference: transferRef,
                        balance_before: fromCurrentBalance,
                        balance_after: fromNewBalance,
                        metadata: { recipient_id: toUserId },
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single(),
                
                supabase
                    .from('transactions')
                    .insert({
                        user_id: toUserId,
                        type: 'transfer_in',
                        amount: transferAmount,
                        description: `${description} (from user ${fromUserId})`,
                        status: 'completed',
                        payment_reference: transferRef,
                        balance_before: parseFloat(toWallet.balance),
                        balance_after: toNewBalance,
                        metadata: { sender_id: fromUserId },
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single()
            ]);

            // Send real-time updates
            realtimeHandler.sendBalanceUpdate(fromUserId, fromNewBalance);
            realtimeHandler.sendBalanceUpdate(toUserId, toNewBalance);

            return {
                success: true,
                from_new_balance: fromNewBalance,
                to_new_balance: toNewBalance,
                transfer_reference: transferRef,
                from_transaction: fromTransaction.data,
                to_transaction: toTransaction.data
            };

        } catch (error) {
            console.error('Transfer funds error:', error);
            throw error;
        }
    }

    // Get wallet transaction history
    async getTransactionHistory(userId, options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                type = null,
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
                transactions: data,
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            };

        } catch (error) {
            console.error('Get transaction history error:', error);
            throw new Error('Failed to retrieve transaction history');
        }
    }

    // Get wallet statistics
    async getWalletStats(userId, period = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - period);

            const { data: transactions, error } = await supabase
                .from('transactions')
                .select('type, amount, created_at')
                .eq('user_id', userId)
                .gte('created_at', startDate.toISOString());

            if (error) {
                throw error;
            }

            // Calculate statistics
            const stats = {
                total_credited: 0,
                total_debited: 0,
                total_transactions: transactions.length,
                credit_transactions: 0,
                debit_transactions: 0,
                recent_activity: []
            };

            transactions.forEach(transaction => {
                const amount = parseFloat(transaction.amount);
                
                if (['credit', 'deposit', 'transfer_in'].includes(transaction.type)) {
                    stats.total_credited += amount;
                    stats.credit_transactions++;
                } else if (['debit', 'withdrawal', 'transfer_out', 'airtime_purchase', 'data_purchase', 'cable_purchase', 'electricity_purchase'].includes(transaction.type)) {
                    stats.total_debited += amount;
                    stats.debit_transactions++;
                }
            });

            // Get recent activity (last 5 transactions)
            stats.recent_activity = transactions
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 5);

            return stats;

        } catch (error) {
            console.error('Get wallet stats error:', error);
            throw new Error('Failed to retrieve wallet statistics');
        }
    }

    // Freeze/unfreeze wallet
    async freezeWallet(userId, reason = 'Administrative action') {
        try {
            const { error } = await supabase
                .from('wallets')
                .update({
                    is_frozen: true,
                    freeze_reason: reason,
                    frozen_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (error) {
                throw error;
            }

            // Log freeze action
            await supabase
                .from('wallet_logs')
                .insert({
                    user_id: userId,
                    action: 'freeze',
                    reason,
                    created_at: new Date().toISOString()
                });

            return { success: true, message: 'Wallet frozen successfully' };

        } catch (error) {
            console.error('Freeze wallet error:', error);
            throw new Error('Failed to freeze wallet');
        }
    }

    async unfreezeWallet(userId, reason = 'Administrative action') {
        try {
            const { error } = await supabase
                .from('wallets')
                .update({
                    is_frozen: false,
                    freeze_reason: null,
                    frozen_at: null,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (error) {
                throw error;
            }

            // Log unfreeze action
            await supabase
                .from('wallet_logs')
                .insert({
                    user_id: userId,
                    action: 'unfreeze',
                    reason,
                    created_at: new Date().toISOString()
                });

            return { success: true, message: 'Wallet unfrozen successfully' };

        } catch (error) {
            console.error('Unfreeze wallet error:', error);
            throw new Error('Failed to unfreeze wallet');
        }
    }

    // Check if wallet is frozen
    async isWalletFrozen(userId) {
        try {
            const { data, error } = await supabase
                .from('wallets')
                .select('is_frozen, freeze_reason')
                .eq('user_id', userId)
                .single();

            if (error) {
                throw error;
            }

            return {
                is_frozen: data.is_frozen || false,
                reason: data.freeze_reason
            };

        } catch (error) {
            console.error('Check wallet freeze status error:', error);
            return { is_frozen: false, reason: null };
        }
    }

    // Set wallet spending limit
    async setSpendingLimit(userId, dailyLimit, monthlyLimit) {
        try {
            const { error } = await supabase
                .from('wallet_limits')
                .upsert({
                    user_id: userId,
                    daily_limit: parseFloat(dailyLimit),
                    monthly_limit: parseFloat(monthlyLimit),
                    updated_at: new Date().toISOString()
                });

            if (error) {
                throw error;
            }

            return { success: true, message: 'Spending limits updated successfully' };

        } catch (error) {
            console.error('Set spending limit error:', error);
            throw new Error('Failed to set spending limits');
        }
    }

    // Check spending limit
    async checkSpendingLimit(userId, amount) {
        try {
            const { data: limits } = await supabase
                .from('wallet_limits')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (!limits) {
                return { allowed: true }; // No limits set
            }

            const today = new Date().toISOString().split('T')[0];
            const thisMonth = new Date().toISOString().substring(0, 7);

            // Get today's spending
            const { data: todaySpending } = await supabase
                .from('transactions')
                .select('amount')
                .eq('user_id', userId)
                .in('type', ['debit', 'transfer_out', 'airtime_purchase', 'data_purchase', 'cable_purchase', 'electricity_purchase'])
                .gte('created_at', `${today}T00:00:00`);

            // Get this month's spending
            const { data: monthSpending } = await supabase
                .from('transactions')
                .select('amount')
                .eq('user_id', userId)
                .in('type', ['debit', 'transfer_out', 'airtime_purchase', 'data_purchase', 'cable_purchase', 'electricity_purchase'])
                .gte('created_at', `${thisMonth}-01T00:00:00`);

            const dailySpent = todaySpending ? todaySpending.reduce((sum, t) => sum + parseFloat(t.amount), 0) : 0;
            const monthlySpent = monthSpending ? monthSpending.reduce((sum, t) => sum + parseFloat(t.amount), 0) : 0;

            const requestedAmount = parseFloat(amount);

            // Check daily limit
            if (limits.daily_limit && (dailySpent + requestedAmount) > limits.daily_limit) {
                return {
                    allowed: false,
                    reason: 'Daily spending limit exceeded',
                    limit: limits.daily_limit,
                    spent: dailySpent
                };
            }

            // Check monthly limit
            if (limits.monthly_limit && (monthlySpent + requestedAmount) > limits.monthly_limit) {
                return {
                    allowed: false,
                    reason: 'Monthly spending limit exceeded',
                    limit: limits.monthly_limit,
                    spent: monthlySpent
                };
            }

            return { allowed: true };

        } catch (error) {
            console.error('Check spending limit error:', error);
            return { allowed: true }; // Allow transaction if check fails
        }
    }
}

const walletService = new WalletService();
module.exports = { walletService };
