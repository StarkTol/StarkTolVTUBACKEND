const { supabase } = require('../config/supabase');

class RealtimeHandler {
    constructor() {
        this.subscriptions = new Map();
        this.channels = new Map();
    }

    // Initialize real-time subscriptions
    init() {
        console.log('Initializing real-time handler...');
        this.setupBalanceSubscription();
        this.setupTransactionSubscription();
        this.setupSupportSubscription();
    }

    // Setup balance update subscriptions
    setupBalanceSubscription() {
        const balanceChannel = supabase
            .channel('wallet_changes')
            .on('postgres_changes', 
                { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'wallets' 
                }, 
                (payload) => {
                    this.handleBalanceUpdate(payload);
                }
            )
            .subscribe();

        this.channels.set('wallet_changes', balanceChannel);
    }

    // Setup transaction subscriptions
    setupTransactionSubscription() {
        const transactionChannel = supabase
            .channel('transaction_changes')
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'transactions' 
                }, 
                (payload) => {
                    this.handleTransactionUpdate(payload);
                }
            )
            .subscribe();

        this.channels.set('transaction_changes', transactionChannel);
    }

    // Setup support ticket subscriptions
    setupSupportSubscription() {
        const supportChannel = supabase
            .channel('support_changes')
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'support_tickets' 
                }, 
                (payload) => {
                    this.handleSupportUpdate(payload);
                }
            )
            .subscribe();

        this.channels.set('support_changes', supportChannel);
    }

    // Handle balance updates
    handleBalanceUpdate(payload) {
        const { new: newRecord, old: oldRecord } = payload;
        
        if (newRecord && oldRecord && newRecord.balance !== oldRecord.balance) {
            const updateData = {
                type: 'balance_update',
                user_id: newRecord.user_id,
                old_balance: oldRecord.balance,
                new_balance: newRecord.balance,
                timestamp: new Date().toISOString()
            };

            this.broadcastToUser(newRecord.user_id, updateData);
            console.log(`Balance updated for user ${newRecord.user_id}: ${oldRecord.balance} -> ${newRecord.balance}`);
        }
    }

    // Handle transaction updates
    handleTransactionUpdate(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        let updateData = {
            type: 'transaction_update',
            event: eventType,
            timestamp: new Date().toISOString()
        };

        switch (eventType) {
            case 'INSERT':
                updateData.transaction = newRecord;
                updateData.message = 'New transaction created';
                this.broadcastToUser(newRecord.user_id, updateData);
                break;
                
            case 'UPDATE':
                if (newRecord.status !== oldRecord.status) {
                    updateData.transaction = newRecord;
                    updateData.old_status = oldRecord.status;
                    updateData.new_status = newRecord.status;
                    updateData.message = `Transaction status changed to ${newRecord.status}`;
                    this.broadcastToUser(newRecord.user_id, updateData);
                }
                break;
                
            case 'DELETE':
                updateData.transaction_id = oldRecord.id;
                updateData.message = 'Transaction deleted';
                this.broadcastToUser(oldRecord.user_id, updateData);
                break;
        }

        console.log(`Transaction ${eventType} for user ${newRecord?.user_id || oldRecord?.user_id}`);
    }

    // Handle support ticket updates
    handleSupportUpdate(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        let updateData = {
            type: 'support_update',
            event: eventType,
            timestamp: new Date().toISOString()
        };

        switch (eventType) {
            case 'INSERT':
                updateData.ticket = newRecord;
                updateData.message = 'New support ticket created';
                this.broadcastToUser(newRecord.user_id, updateData);
                break;
                
            case 'UPDATE':
                if (newRecord.status !== oldRecord.status) {
                    updateData.ticket = newRecord;
                    updateData.old_status = oldRecord.status;
                    updateData.new_status = newRecord.status;
                    updateData.message = `Ticket status changed to ${newRecord.status}`;
                    this.broadcastToUser(newRecord.user_id, updateData);
                }
                break;
        }

        console.log(`Support ticket ${eventType} for user ${newRecord?.user_id || oldRecord?.user_id}`);
    }

    // Send balance update to specific user
    sendBalanceUpdate(userId, newBalance) {
        const updateData = {
            type: 'balance_update',
            user_id: userId,
            new_balance: newBalance,
            timestamp: new Date().toISOString()
        };

        this.broadcastToUser(userId, updateData);
    }

    // Send transaction update to specific user
    sendTransactionUpdate(userId, transaction, message = 'Transaction updated') {
        const updateData = {
            type: 'transaction_update',
            user_id: userId,
            transaction,
            message,
            timestamp: new Date().toISOString()
        };

        this.broadcastToUser(userId, updateData);
    }

    // Send support ticket update
    sendSupportUpdate(userId, ticket, message = 'Support ticket updated') {
        const updateData = {
            type: 'support_update',
            user_id: userId,
            ticket,
            message,
            timestamp: new Date().toISOString()
        };

        this.broadcastToUser(userId, updateData);
    }

    // Send referral update
    sendReferralUpdate(userId, referralData, message = 'Referral update') {
        const updateData = {
            type: 'referral_update',
            user_id: userId,
            referral: referralData,
            message,
            timestamp: new Date().toISOString()
        };

        this.broadcastToUser(userId, updateData);
    }

    // Send commission update to reseller
    sendCommissionUpdate(resellerId, commission, message = 'New commission earned') {
        const updateData = {
            type: 'commission_update',
            user_id: resellerId,
            commission,
            message,
            timestamp: new Date().toISOString()
        };

        this.broadcastToUser(resellerId, updateData);
    }

    // Broadcast message to specific user
    broadcastToUser(userId, data) {
        // In a real implementation with WebSocket support, you would:
        // 1. Find all active connections for the user
        // 2. Send the data to each connection
        // For now, we'll log the broadcast and store it for potential polling
        
        console.log(`Broadcasting to user ${userId}:`, data);
        
        // Store the update in a table for polling fallback
        this.storeRealtimeUpdate(userId, data);
    }

    // Store real-time update for polling fallback
    async storeRealtimeUpdate(userId, data) {
        try {
            await supabase
                .from('realtime_updates')
                .insert({
                    user_id: userId,
                    update_type: data.type,
                    data: data,
                    is_read: false,
                    created_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
                });
        } catch (error) {
            console.error('Failed to store realtime update:', error);
        }
    }

    // Get pending updates for a user (polling endpoint)
    async getPendingUpdates(userId, limit = 50) {
        try {
            const { data: updates, error } = await supabase
                .from('realtime_updates')
                .select('*')
                .eq('user_id', userId)
                .eq('is_read', false)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                throw error;
            }

            // Mark updates as read
            if (updates && updates.length > 0) {
                const updateIds = updates.map(u => u.id);
                await supabase
                    .from('realtime_updates')
                    .update({ is_read: true })
                    .in('id', updateIds);
            }

            return updates || [];

        } catch (error) {
            console.error('Failed to get pending updates:', error);
            return [];
        }
    }

    // Subscribe to user-specific channel
    subscribeToUser(userId, callback) {
        const channelName = `user_${userId}`;
        
        if (this.subscriptions.has(channelName)) {
            // Already subscribed
            return this.subscriptions.get(channelName);
        }

        const subscription = supabase
            .channel(channelName)
            .on('broadcast', { event: 'update' }, callback)
            .subscribe();

        this.subscriptions.set(channelName, subscription);
        return subscription;
    }

    // Unsubscribe from user-specific channel
    unsubscribeFromUser(userId) {
        const channelName = `user_${userId}`;
        const subscription = this.subscriptions.get(channelName);
        
        if (subscription) {
            supabase.removeChannel(subscription);
            this.subscriptions.delete(channelName);
            return true;
        }
        
        return false;
    }

    // Send notification to user
    async sendNotification(userId, notification) {
        try {
            const notificationData = {
                user_id: userId,
                title: notification.title,
                message: notification.message,
                type: notification.type || 'info',
                data: notification.data || {},
                is_read: false,
                created_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('notifications')
                .insert(notificationData)
                .select()
                .single();

            if (error) {
                throw error;
            }

            // Broadcast notification
            this.broadcastToUser(userId, {
                type: 'notification',
                notification: data,
                timestamp: new Date().toISOString()
            });

            return data;

        } catch (error) {
            console.error('Failed to send notification:', error);
            throw error;
        }
    }

    // Get user notifications
    async getUserNotifications(userId, limit = 20, offset = 0) {
        try {
            const { data: notifications, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                throw error;
            }

            return notifications || [];

        } catch (error) {
            console.error('Failed to get notifications:', error);
            return [];
        }
    }

    // Mark notification as read
    async markNotificationAsRead(notificationId, userId) {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', notificationId)
                .eq('user_id', userId);

            if (error) {
                throw error;
            }

            return true;

        } catch (error) {
            console.error('Failed to mark notification as read:', error);
            return false;
        }
    }

    // Cleanup expired updates
    async cleanupExpiredUpdates() {
        try {
            const { error } = await supabase
                .from('realtime_updates')
                .delete()
                .lt('expires_at', new Date().toISOString());

            if (error) {
                console.error('Failed to cleanup expired updates:', error);
            } else {
                console.log('Cleaned up expired realtime updates');
            }

        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    // Cleanup old notifications
    async cleanupOldNotifications() {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('is_read', true)
                .lt('created_at', thirtyDaysAgo.toISOString());

            if (error) {
                console.error('Failed to cleanup old notifications:', error);
            } else {
                console.log('Cleaned up old notifications');
            }

        } catch (error) {
            console.error('Notification cleanup error:', error);
        }
    }

    // Start cleanup interval
    startCleanupInterval() {
        // Run cleanup every hour
        setInterval(() => {
            this.cleanupExpiredUpdates();
            this.cleanupOldNotifications();
        }, 60 * 60 * 1000);
    }

    // Shutdown handler
    shutdown() {
        console.log('Shutting down realtime handler...');
        
        // Unsubscribe from all channels
        for (const [name, channel] of this.channels.entries()) {
            supabase.removeChannel(channel);
            console.log(`Unsubscribed from ${name}`);
        }
        
        // Clear subscriptions
        for (const [name, subscription] of this.subscriptions.entries()) {
            supabase.removeChannel(subscription);
            console.log(`Unsubscribed user channel ${name}`);
        }
        
        this.channels.clear();
        this.subscriptions.clear();
    }
}

const realtimeHandler = new RealtimeHandler();
module.exports = { realtimeHandler };
