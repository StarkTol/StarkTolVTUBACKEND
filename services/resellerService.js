const { supabase } = require('../config/supabase');
const { walletService } = require('./walletService');

class ResellerService {
    // Get reseller statistics
    async getResellerStats(userId, period = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - period);

            // Get reseller data
            const { data: resellerData, error: resellerError } = await supabase
                .from('resellers')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (resellerError) {
                throw resellerError;
            }

            // Get transaction statistics
            const { data: transactions, error: transactionError } = await supabase
                .from('transactions')
                .select('type, amount, status, created_at')
                .eq('user_id', userId)
                .gte('created_at', startDate.toISOString());

            if (transactionError) {
                console.error('Transaction stats error:', transactionError);
            }

            // Get sub-reseller count
            const { count: subResellerCount, error: subResellerError } = await supabase
                .from('sub_resellers')
                .select('id', { count: 'exact' })
                .eq('reseller_id', userId)
                .eq('status', 'active');

            if (subResellerError) {
                console.error('Sub-reseller count error:', subResellerError);
            }

            // Get commission earnings
            const { data: commissions, error: commissionError } = await supabase
                .from('commissions')
                .select('amount')
                .eq('reseller_id', userId)
                .gte('created_at', startDate.toISOString());

            if (commissionError) {
                console.error('Commission stats error:', commissionError);
            }

            // Calculate statistics
            const stats = {
                reseller_level: resellerData.level || 'basic',
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
                },
                period_days: period
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
            console.error('Get reseller stats error:', error);
            throw new Error('Failed to retrieve reseller statistics');
        }
    }

    // Calculate commission for a transaction
    async calculateCommission(userId, transactionAmount, serviceType) {
        try {
            // Get reseller data
            const { data: resellerData, error } = await supabase
                .from('resellers')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'approved')
                .single();

            if (error || !resellerData) {
                return { commission: 0, discount: 0 };
            }

            let discountPercentage = 0;
            let commissionPercentage = 0;

            // Get discount based on service type
            switch (serviceType) {
                case 'airtime':
                    discountPercentage = parseFloat(resellerData.airtime_discount || 0);
                    commissionPercentage = parseFloat(resellerData.airtime_commission || 0);
                    break;
                case 'data':
                    discountPercentage = parseFloat(resellerData.data_discount || 0);
                    commissionPercentage = parseFloat(resellerData.data_commission || 0);
                    break;
                case 'cable':
                    discountPercentage = parseFloat(resellerData.cable_discount || 0);
                    commissionPercentage = parseFloat(resellerData.cable_commission || 0);
                    break;
                case 'electricity':
                    discountPercentage = parseFloat(resellerData.electricity_discount || 0);
                    commissionPercentage = parseFloat(resellerData.electricity_commission || 0);
                    break;
                default:
                    break;
            }

            const amount = parseFloat(transactionAmount);
            const discount = (amount * discountPercentage) / 100;
            const commission = (amount * commissionPercentage) / 100;

            return {
                discount,
                commission,
                discount_percentage: discountPercentage,
                commission_percentage: commissionPercentage
            };

        } catch (error) {
            console.error('Calculate commission error:', error);
            return { commission: 0, discount: 0 };
        }
    }

    // Process commission for a completed transaction
    async processCommission(transactionId, userId, amount, serviceType) {
        try {
            const commission = await this.calculateCommission(userId, amount, serviceType);

            if (commission.commission > 0) {
                // Create commission record
                const { data: commissionRecord, error } = await supabase
                    .from('commissions')
                    .insert({
                        reseller_id: userId,
                        transaction_id: transactionId,
                        amount: commission.commission,
                        commission_percentage: commission.commission_percentage,
                        service_type: serviceType,
                        status: 'earned',
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (error) {
                    console.error('Commission record error:', error);
                    return { success: false, error: error.message };
                }

                return { success: true, commission: commissionRecord };
            }

            return { success: true, commission: null };

        } catch (error) {
            console.error('Process commission error:', error);
            return { success: false, error: error.message };
        }
    }

    // Upgrade reseller level based on performance
    async evaluateResellerUpgrade(userId) {
        try {
            const { data: resellerData, error } = await supabase
                .from('resellers')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error || !resellerData) {
                return { upgrade: false };
            }

            // Get last 90 days performance
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 90);

            const { data: transactions, error: transactionError } = await supabase
                .from('transactions')
                .select('amount')
                .eq('user_id', userId)
                .eq('status', 'completed')
                .in('type', ['airtime_purchase', 'data_purchase', 'cable_purchase', 'electricity_purchase'])
                .gte('created_at', startDate.toISOString());

            if (transactionError) {
                console.error('Transaction evaluation error:', transactionError);
                return { upgrade: false };
            }

            const totalSales = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
            const currentLevel = resellerData.level || 'basic';

            // Define upgrade thresholds
            const thresholds = {
                basic: { min: 0, max: 50000, next: 'silver' },
                silver: { min: 50000, max: 200000, next: 'gold' },
                gold: { min: 200000, max: 500000, next: 'platinum' },
                platinum: { min: 500000, max: Infinity, next: null }
            };

            const currentThreshold = thresholds[currentLevel];
            
            if (currentThreshold && totalSales >= currentThreshold.max && currentThreshold.next) {
                // Upgrade reseller level
                const { error: upgradeError } = await supabase
                    .from('resellers')
                    .update({
                        level: currentThreshold.next,
                        upgraded_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', userId);

                if (upgradeError) {
                    console.error('Upgrade error:', upgradeError);
                    return { upgrade: false };
                }

                return {
                    upgrade: true,
                    from: currentLevel,
                    to: currentThreshold.next,
                    sales_volume: totalSales
                };
            }

            return { upgrade: false, current_level: currentLevel, sales_volume: totalSales };

        } catch (error) {
            console.error('Evaluate reseller upgrade error:', error);
            return { upgrade: false };
        }
    }

    // Get reseller performance metrics
    async getPerformanceMetrics(userId, period = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - period);

            // Get transaction performance
            const { data: transactions, error } = await supabase
                .from('transactions')
                .select('amount, status, type, created_at')
                .eq('user_id', userId)
                .gte('created_at', startDate.toISOString());

            if (error) {
                throw error;
            }

            // Calculate metrics
            const metrics = {
                total_volume: 0,
                success_rate: 0,
                avg_transaction_size: 0,
                daily_averages: {},
                service_distribution: {
                    airtime: 0,
                    data: 0,
                    cable: 0,
                    electricity: 0
                }
            };

            let successfulTransactions = 0;
            let totalTransactions = transactions.length;

            transactions.forEach(transaction => {
                const amount = parseFloat(transaction.amount);
                const date = transaction.created_at.split('T')[0];

                if (transaction.status === 'completed') {
                    metrics.total_volume += amount;
                    successfulTransactions++;

                    // Daily aggregation
                    if (!metrics.daily_averages[date]) {
                        metrics.daily_averages[date] = { volume: 0, count: 0 };
                    }
                    metrics.daily_averages[date].volume += amount;
                    metrics.daily_averages[date].count++;

                    // Service distribution
                    if (transaction.type === 'airtime_purchase') {
                        metrics.service_distribution.airtime += amount;
                    } else if (transaction.type === 'data_purchase') {
                        metrics.service_distribution.data += amount;
                    } else if (transaction.type === 'cable_purchase') {
                        metrics.service_distribution.cable += amount;
                    } else if (transaction.type === 'electricity_purchase') {
                        metrics.service_distribution.electricity += amount;
                    }
                }
            });

            if (totalTransactions > 0) {
                metrics.success_rate = ((successfulTransactions / totalTransactions) * 100).toFixed(2);
            }

            if (successfulTransactions > 0) {
                metrics.avg_transaction_size = (metrics.total_volume / successfulTransactions).toFixed(2);
            }

            return metrics;

        } catch (error) {
            console.error('Get performance metrics error:', error);
            throw new Error('Failed to retrieve performance metrics');
        }
    }

    // Set reseller discounts
    async setResellerDiscounts(userId, discounts) {
        try {
            const { error } = await supabase
                .from('resellers')
                .update({
                    airtime_discount: discounts.airtime_discount || 0,
                    data_discount: discounts.data_discount || 0,
                    cable_discount: discounts.cable_discount || 0,
                    electricity_discount: discounts.electricity_discount || 0,
                    airtime_commission: discounts.airtime_commission || 0,
                    data_commission: discounts.data_commission || 0,
                    cable_commission: discounts.cable_commission || 0,
                    electricity_commission: discounts.electricity_commission || 0,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (error) {
                throw error;
            }

            return { success: true, message: 'Reseller discounts updated successfully' };

        } catch (error) {
            console.error('Set reseller discounts error:', error);
            throw new Error('Failed to update reseller discounts');
        }
    }

    // Get sub-reseller performance
    async getSubResellerPerformance(resellerId, period = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - period);

            // Get sub-resellers
            const { data: subResellers, error } = await supabase
                .from('sub_resellers')
                .select(`
                    *,
                    users!inner(full_name, email)
                `)
                .eq('reseller_id', resellerId)
                .eq('status', 'active');

            if (error) {
                throw error;
            }

            const performanceData = [];

            for (const subReseller of subResellers) {
                // Get transaction data for each sub-reseller
                const { data: transactions } = await supabase
                    .from('transactions')
                    .select('amount, status, type')
                    .eq('user_id', subReseller.user_id)
                    .eq('status', 'completed')
                    .gte('created_at', startDate.toISOString());

                const totalVolume = transactions ? transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0) : 0;
                const transactionCount = transactions ? transactions.length : 0;

                performanceData.push({
                    sub_reseller_id: subReseller.id,
                    user_name: subReseller.users.full_name,
                    user_email: subReseller.users.email,
                    total_volume: totalVolume,
                    transaction_count: transactionCount,
                    commission_percentage: subReseller.commission_percentage,
                    estimated_commission: (totalVolume * subReseller.commission_percentage) / 100,
                    created_at: subReseller.created_at
                });
            }

            // Sort by total volume
            performanceData.sort((a, b) => b.total_volume - a.total_volume);

            return performanceData;

        } catch (error) {
            console.error('Get sub-reseller performance error:', error);
            throw new Error('Failed to retrieve sub-reseller performance');
        }
    }
}

const resellerService = new ResellerService();
module.exports = { resellerService };
