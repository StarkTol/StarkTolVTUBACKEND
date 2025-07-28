const { supabase, supabaseAdmin } = require('../config/supabaseClient');
const { realtimeHandler } = require('../utils/realtimeHandler');

// Custom error classes
class InsufficientFundsError extends Error {
    constructor(message = 'Insufficient wallet balance') {
        super(message);
        this.name = 'InsufficientFundsError';
        this.code = 'INSUFFICIENT_FUNDS';
    }
}

class WalletFrozenError extends Error {
    constructor(message = 'Wallet is frozen') {
        super(message);
        this.name = 'WalletFrozenError';
        this.code = 'WALLET_FROZEN';
    }
}

class TransactionError extends Error {
    constructor(message = 'Transaction failed') {
        super(message);
        this.name = 'TransactionError';
        this.code = 'TRANSACTION_ERROR';
    }
}

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

    // Get wallet balance
    async getBalance(userId) {
        try {
            const wallet = await this.getWallet(userId);
            return wallet.balance;
        } catch (error) {
            console.error('Get balance error:', error);
            throw new Error('Failed to retrieve balance');
        }
    }

    // Credit wallet (add funds) with atomicity
    async credit(userId, amount, description = 'Wallet credit', transactionRef = null) {
        // Begin database transaction for atomicity
        const client = supabaseAdmin;
        
        try {
            const creditAmount = parseFloat(amount);
            if (creditAmount <= 0) {
                throw new TransactionError('Credit amount must be greater than zero');
            }

            // Check if wallet is frozen
            const frozenStatus = await this.isWalletFrozen(userId);
            if (frozenStatus.is_frozen) {
                throw new WalletFrozenError(`Wallet is frozen: ${frozenStatus.reason}`);
            }

            // Start RPC transaction for atomicity
            const { data: result, error } = await client.rpc('credit_wallet_atomic', {
                p_user_id: userId,
                p_amount: creditAmount,
                p_description: description,
                p_transaction_ref: transactionRef || `CREDIT_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
            });

            if (error) {
                throw new TransactionError(`Credit operation failed: ${error.message}`);
            }

            // Emit Supabase channel events after successful commit
            await this.emitWalletUpdated(userId, result.new_balance);
            await this.emitTransactionCreated(userId, result.transaction);

            // Send real-time updates
            realtimeHandler.sendBalanceUpdate(userId, result.new_balance);
            realtimeHandler.sendTransactionUpdate(userId, result.transaction, 'Wallet credited successfully');

            return {
                success: true,
                new_balance: result.new_balance,
                transaction: result.transaction
            };

        } catch (error) {
            console.error('Credit wallet error:', error);
            if (error instanceof WalletFrozenError || error instanceof TransactionError) {
                throw error;
            }
            throw new TransactionError('Failed to credit wallet');
        }
    }

    // Legacy method for backward compatibility
    async creditWallet(userId, amount, description = 'Wallet credit', transactionRef = null) {
        return this.credit(userId, amount, description, transactionRef);
    }

    // Debit wallet (subtract funds) with atomicity
    async debit(userId, amount, description = 'Wallet debit', transactionRef = null) {
        const client = supabaseAdmin;
        
        try {
            const debitAmount = parseFloat(amount);
            if (debitAmount <= 0) {
                throw new TransactionError('Debit amount must be greater than zero');
            }

            // Check if wallet is frozen
            const frozenStatus = await this.isWalletFrozen(userId);
            if (frozenStatus.is_frozen) {
                throw new WalletFrozenError(`Wallet is frozen: ${frozenStatus.reason}`);
            }

            // Check spending limits
            const limitCheck = await this.checkSpendingLimit(userId, debitAmount);
            if (!limitCheck.allowed) {
                throw new TransactionError(limitCheck.reason);
            }

            // Start RPC transaction for atomicity with balance check
            const { data: result, error } = await client.rpc('debit_wallet_atomic', {
                p_user_id: userId,
                p_amount: debitAmount,
                p_description: description,
                p_transaction_ref: transactionRef || `DEBIT_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
            });

            if (error) {
                if (error.message.includes('insufficient')) {
                    throw new InsufficientFundsError('Insufficient wallet balance');
                }
                throw new TransactionError(`Debit operation failed: ${error.message}`);
            }

            // Emit Supabase channel events after successful commit
            await this.emitWalletUpdated(userId, result.new_balance);
            await this.emitTransactionCreated(userId, result.transaction);

            // Send real-time updates
            realtimeHandler.sendBalanceUpdate(userId, result.new_balance);
            realtimeHandler.sendTransactionUpdate(userId, result.transaction, 'Wallet debited successfully');

            return {
                success: true,
                new_balance: result.new_balance,
                transaction: result.transaction
            };

        } catch (error) {
            console.error('Debit wallet error:', error);
            if (error instanceof InsufficientFundsError || error instanceof WalletFrozenError || error instanceof TransactionError) {
                throw error;
            }
            throw new TransactionError('Failed to debit wallet');
        }
    }

    // Legacy method for backward compatibility
    async debitWallet(userId, amount, description = 'Wallet debit', transactionRef = null) {
        return this.debit(userId, amount, description, transactionRef);
    }

    // Transfer funds between wallets with atomicity
    async transfer(fromUserId, toUserId, amount, description = 'Wallet transfer') {
        const client = supabaseAdmin;

        try {
            const transferAmount = parseFloat(amount);
            if (transferAmount <= 0) {
                throw new TransactionError('Transfer amount must be greater than zero');
            }

            // Check if wallets are frozen
            const [fromFrozenStatus, toFrozenStatus] = await Promise.all([
                this.isWalletFrozen(fromUserId),
                this.isWalletFrozen(toUserId)
            ]);
            if (fromFrozenStatus.is_frozen) {
                throw new WalletFrozenError(`Sender's wallet is frozen: ${fromFrozenStatus.reason}`);
            }
            if (toFrozenStatus.is_frozen) {
                throw new WalletFrozenError(`Recipient's wallet is frozen: ${toFrozenStatus.reason}`);
            }

            // Start RPC transaction for atomicity
            const { data: result, error } = await client.rpc('transfer_wallet_atomic', {
                p_from_user_id: fromUserId,
                p_to_user_id: toUserId,
                p_amount: transferAmount,
                p_description: description,
                p_transaction_ref: `TRANSFER_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
            });

            if (error) {
                if (error.message.includes('insufficient')) {
                    throw new InsufficientFundsError('Insufficient wallet balance');
                }
                throw new TransactionError(`Transfer operation failed: ${error.message}`);
            }

            // Emit Supabase channel events after successful commit
            await this.emitWalletUpdated(fromUserId, result.from_new_balance);
            await this.emitWalletUpdated(toUserId, result.to_new_balance);
            await this.emitTransactionCreated(fromUserId, result.from_transaction);
            await this.emitTransactionCreated(toUserId, result.to_transaction);

            // Send real-time updates
            realtimeHandler.sendBalanceUpdate(fromUserId, result.from_new_balance);
            realtimeHandler.sendBalanceUpdate(toUserId, result.to_new_balance);
            realtimeHandler.sendTransactionUpdate(fromUserId, result.from_transaction, 'Funds transferred successfully');
            realtimeHandler.sendTransactionUpdate(toUserId, result.to_transaction, 'Funds received successfully');

            return {
                success: true,
                from_new_balance: result.from_new_balance,
                to_new_balance: result.to_new_balance,
                transfer_reference: result.transfer_reference,
                from_transaction: result.from_transaction,
                to_transaction: result.to_transaction
            };

        } catch (error) {
            console.error('Transfer funds error:', error);
            if (error instanceof InsufficientFundsError || error instanceof WalletFrozenError || error instanceof TransactionError) {
                throw error;
            }
            throw new TransactionError('Failed to transfer funds');
        }
    }

    // Legacy method for backward compatibility
    async transferFunds(fromUserId, toUserId, amount, description = 'Wallet transfer') {
        return this.transfer(fromUserId, toUserId, amount, description);
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

    // List transactions (alias for getTransactionHistory)
    async listTransactions(userId, options = {}) {
        return this.getTransactionHistory(userId, options);
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

    // Emit wallet.updated event to Supabase channel
    async emitWalletUpdated(userId, newBalance) {
        try {
            await supabaseAdmin
                .channel(`wallet_${userId}`)
                .send({
                    type: 'broadcast',
                    event: 'wallet.updated', 
                    payload: {
                        user_id: userId,
                        new_balance: newBalance,
                        timestamp: new Date().toISOString()
                    }
                });
        } catch (error) {
            console.error('Failed to emit wallet.updated event:', error);
        }
    }

    // Emit transaction.created event to Supabase channel
    async emitTransactionCreated(userId, transaction) {
        try {
            await supabaseAdmin
                .channel(`transaction_${userId}`)
                .send({
                    type: 'broadcast',
                    event: 'transaction.created',
                    payload: {
                        user_id: userId,
                        transaction: transaction,
                        timestamp: new Date().toISOString()
                    }
                });
        } catch (error) {
            console.error('Failed to emit transaction.created event:', error);
        }
    }
}

const walletService = new WalletService();
module.exports = { 
    walletService, 
    InsufficientFundsError,
    WalletFrozenError,
    TransactionError
};
