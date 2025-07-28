const { supabase } = require('../config/supabase');
const { realtimeHandler } = require('../utils/realtimeHandler');

/**
 * Notification Service for handling all platform notifications
 * Supports: Transaction notifications, Wallet credits, Support replies
 * Uses Supabase real-time for instant push notifications
 */
class NotificationService {
    /**
     * Create and send notification to user
     * @param {string} userId - User ID to send notification to
     * @param {Object} notificationData - Notification details
     */
    async createNotification(userId, { title, message, type = 'info', metadata = {} }) {
        try {
            const notificationData = {
                user_id: userId,
                title,
                message,
                type,
                metadata,
                is_read: false
            };

            console.log(`📧 Creating notification for user ${userId}:`, { title, type });

            const { data: notification, error } = await supabase
                .from('notifications')
                .insert(notificationData)
                .select()
                .single();

            if (error) {
                console.error('Database insert error:', error);
                throw error;
            }

            // Send real-time notification via Supabase real-time
            try {
                await this.sendRealtimeNotification(userId, {
                    id: notification.id,
                    title,
                    message,
                    type,
                    metadata,
                    created_at: notification.created_at
                });
            } catch (realtimeError) {
                console.error('Real-time notification failed:', realtimeError);
                // Don't fail the whole operation if real-time fails
            }

            console.log(`✅ Notification created successfully:`, notification.id);

            return {
                success: true,
                notification
            };

        } catch (error) {
            console.error('Create notification error:', error);
            throw new Error(`Failed to create notification: ${error.message}`);
        }
    }

    // Get user notifications with pagination
    async getUserNotifications(userId, options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                unreadOnly = false,
                type = null
            } = options;

            const offset = (page - 1) * limit;

            let query = supabase
                .from('notifications')
                .select('*', { count: 'exact' })
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            // Apply filters
            if (unreadOnly) {
                query = query.eq('is_read', false);
            }

            if (type) {
                query = query.eq('type', type);
            }

            const { data: notifications, error, count } = await query;

            if (error) {
                throw error;
            }

            return {
                success: true,
                notifications: notifications || [],
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit),
                    hasNext: page < Math.ceil(count / limit),
                    hasPrev: page > 1
                }
            };

        } catch (error) {
            console.error('Get user notifications error:', error);
            throw new Error('Failed to retrieve notifications');
        }
    }

    // Mark notification as read
    async markAsRead(notificationId, userId) {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .update({
                    is_read: true,
                    read_at: new Date().toISOString()
                })
                .eq('id', notificationId)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                throw error;
            }

            return {
                success: true,
                notification: data
            };

        } catch (error) {
            console.error('Mark notification as read error:', error);
            throw new Error('Failed to mark notification as read');
        }
    }

    // Mark all notifications as read for user
    async markAllAsRead(userId) {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .update({
                    is_read: true,
                    read_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .eq('is_read', false);

            if (error) {
                throw error;
            }

            return {
                success: true,
                updated_count: data?.length || 0
            };

        } catch (error) {
            console.error('Mark all notifications as read error:', error);
            throw new Error('Failed to mark all notifications as read');
        }
    }

    // Get unread notification count
    async getUnreadCount(userId) {
        try {
            const { count, error } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('is_read', false);

            if (error) {
                throw error;
            }

            return {
                success: true,
                count: count || 0
            };

        } catch (error) {
            console.error('Get unread count error:', error);
            throw new Error('Failed to get unread notification count');
        }
    }

    // Delete notification
    async deleteNotification(notificationId, userId) {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                throw error;
            }

            return {
                success: true,
                deleted_notification: data
            };

        } catch (error) {
            console.error('Delete notification error:', error);
            throw new Error('Failed to delete notification');
        }
    }

    // Send system-wide notification to all users
    async sendSystemNotification({ title, message, type = 'system', data = {} }) {
        try {
            // Get all active users
            const { data: users, error: usersError } = await supabase
                .from('users')
                .select('id')
                .eq('status', 'active');

            if (usersError) {
                throw usersError;
            }

            // Create notifications for all users
            const notifications = users.map(user => ({
                user_id: user.id,
                title,
                message,
                type,
                data,
                is_read: false,
                created_at: new Date().toISOString()
            }));

            const { data: createdNotifications, error } = await supabase
                .from('notifications')
                .insert(notifications)
                .select();

            if (error) {
                throw error;
            }

            // Send real-time notifications to all users
            for (const user of users) {
                await realtimeHandler.sendNotification(user.id, {
                    title,
                    message,
                    type,
                    data
                });
            }

            return {
                success: true,
                sent_to: users.length,
                notifications: createdNotifications
            };

        } catch (error) {
            console.error('Send system notification error:', error);
            throw new Error('Failed to send system notification');
        }
    }

    // Send transaction-related notifications
    async sendTransactionNotification(userId, transactionType, transactionData) {
        try {
            let notificationConfig = {};

            switch (transactionType) {
                case 'wallet_credited':
                    notificationConfig = {
                        title: 'Wallet Credited',
                        message: `Your wallet has been credited with ₦${transactionData.amount.toFixed(2)}`,
                        type: 'success',
                        data: {
                            amount: transactionData.amount,
                            reference: transactionData.reference,
                            new_balance: transactionData.new_balance
                        }
                    };
                    break;

                case 'purchase_successful':
                    notificationConfig = {
                        title: 'Purchase Successful',
                        message: `Your ${transactionData.service_type} purchase was successful`,
                        type: 'success',
                        data: {
                            service_type: transactionData.service_type,
                            amount: transactionData.amount,
                            reference: transactionData.reference
                        }
                    };
                    break;

                case 'purchase_failed':
                    notificationConfig = {
                        title: 'Purchase Failed',
                        message: `Your ${transactionData.service_type} purchase failed. Amount has been refunded.`,
                        type: 'error',
                        data: {
                            service_type: transactionData.service_type,
                            amount: transactionData.amount,
                            reason: transactionData.reason
                        }
                    };
                    break;

                case 'low_balance':
                    notificationConfig = {
                        title: 'Low Balance Alert',
                        message: `Your wallet balance is low (₦${transactionData.balance.toFixed(2)}). Please fund your wallet.`,
                        type: 'warning',
                        data: {
                            balance: transactionData.balance
                        }
                    };
                    break;

                default:
                    return { success: false, message: 'Unknown transaction type' };
            }

            return await this.createNotification(userId, notificationConfig);

        } catch (error) {
            console.error('Send transaction notification error:', error);
            throw new Error('Failed to send transaction notification');
        }
    }

    /**
     * Send real-time notification using Supabase real-time
     * @param {string} userId - User ID to send notification to
     * @param {Object} notificationData - Notification payload
     */
    async sendRealtimeNotification(userId, notificationData) {
        try {
            // Use Supabase real-time channels for instant notifications
            const channel = supabase.channel(`notifications:${userId}`);
            
            await channel.send({
                type: 'broadcast',
                event: 'new_notification',
                payload: notificationData
            });

            console.log(`📡 Real-time notification sent to user ${userId}`);
            
        } catch (error) {
            console.error('Real-time notification error:', error);
            // Try fallback with realtimeHandler if available
            if (realtimeHandler && realtimeHandler.sendNotification) {
                await realtimeHandler.sendNotification(userId, notificationData);
            }
        }
    }

    /**
     * Send successful transaction notification
     * @param {string} userId - User ID
     * @param {Object} transactionData - Transaction details
     */
    async sendSuccessfulTransactionNotification(userId, transactionData) {
        try {
            const { type, amount, reference, service_details } = transactionData;
            
            let title, message;
            
            switch (type) {
                case 'airtime_purchase':
                    title = 'Airtime Purchase Successful';
                    message = `₦${amount} airtime sent to ${service_details?.phone_number} successfully`;
                    break;
                case 'data_purchase':
                    title = 'Data Purchase Successful';
                    message = `${service_details?.data_plan} data sent to ${service_details?.phone_number} successfully`;
                    break;
                case 'cable_purchase':
                    title = 'Cable TV Subscription Successful';
                    message = `${service_details?.provider} subscription for ${service_details?.smartcard_number} was successful`;
                    break;
                case 'electricity_purchase':
                    title = 'Electricity Bill Payment Successful';
                    message = `₦${amount} electricity token purchased for meter ${service_details?.meter_number}`;
                    break;
                default:
                    title = 'Transaction Successful';
                    message = `Your transaction of ₦${amount} was completed successfully`;
            }

            return await this.createNotification(userId, {
                title,
                message,
                type: 'success',
                metadata: {
                    transaction_type: type,
                    amount,
                    reference,
                    service_details,
                    timestamp: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('Send successful transaction notification error:', error);
            throw error;
        }
    }

    /**
     * Send wallet credit notification
     * @param {string} userId - User ID
     * @param {Object} creditData - Wallet credit details
     */
    async sendWalletCreditNotification(userId, creditData) {
        try {
            const { amount, reference, payment_method, new_balance } = creditData;
            
            const title = 'Wallet Credited';
            const message = `Your wallet has been credited with ₦${amount.toFixed(2)}. New balance: ₦${new_balance.toFixed(2)}`;
            
            return await this.createNotification(userId, {
                title,
                message,
                type: 'success',
                metadata: {
                    transaction_type: 'wallet_credit',
                    amount,
                    reference,
                    payment_method,
                    new_balance,
                    timestamp: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('Send wallet credit notification error:', error);
            throw error;
        }
    }

    /**
     * Send support reply notification
     * @param {string} userId - User ID
     * @param {Object} replyData - Support reply details
     */
    async sendSupportReplyNotification(userId, replyData) {
        try {
            const { ticket_id, subject, reply_message, admin_name } = replyData;
            
            const title = 'Support Reply Received';
            const message = `${admin_name || 'Support team'} replied to your ticket: "${subject}"`;
            
            return await this.createNotification(userId, {
                title,
                message,
                type: 'info',
                metadata: {
                    notification_type: 'support_reply',
                    ticket_id,
                    subject,
                    admin_name,
                    reply_preview: reply_message?.substring(0, 100),
                    timestamp: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('Send support reply notification error:', error);
            throw error;
        }
    }

    /**
     * Send failed transaction notification
     * @param {string} userId - User ID
     * @param {Object} transactionData - Failed transaction details
     */
    async sendFailedTransactionNotification(userId, transactionData) {
        try {
            const { type, amount, reason, reference } = transactionData;
            
            const title = 'Transaction Failed';
            const message = `Your ${type.replace('_', ' ')} transaction of ₦${amount} failed. ${reason || 'Please try again.'}`;
            
            return await this.createNotification(userId, {
                title,
                message,
                type: 'error',
                metadata: {
                    transaction_type: type,
                    amount,
                    reason,
                    reference,
                    timestamp: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('Send failed transaction notification error:', error);
            throw error;
        }
    }

    /**
     * Send low balance warning notification
     * @param {string} userId - User ID
     * @param {Object} balanceData - Balance information
     */
    async sendLowBalanceNotification(userId, balanceData) {
        try {
            const { current_balance, threshold = 500 } = balanceData;
            
            const title = 'Low Balance Alert';
            const message = `Your wallet balance is low (₦${current_balance.toFixed(2)}). Please fund your wallet to continue making transactions.`;
            
            return await this.createNotification(userId, {
                title,
                message,
                type: 'warning',
                metadata: {
                    notification_type: 'low_balance',
                    current_balance,
                    threshold,
                    timestamp: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('Send low balance notification error:', error);
            throw error;
        }
    }

    /**
     * Mark notification as unread (for testing or admin purposes)
     * @param {string} notificationId - Notification ID
     * @param {string} userId - User ID
     */
    async markAsUnread(notificationId, userId) {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .update({ is_read: false })
                .eq('id', notificationId)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                throw error;
            }

            return {
                success: true,
                notification: data
            };

        } catch (error) {
            console.error('Mark notification as unread error:', error);
            throw new Error('Failed to mark notification as unread');
        }
    }

    /**
     * Get notifications by type
     * @param {string} userId - User ID
     * @param {string} type - Notification type
     * @param {Object} options - Pagination options
     */
    async getNotificationsByType(userId, type, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const { data: notifications, error, count } = await supabase
                .from('notifications')
                .select('*', { count: 'exact' })
                .eq('user_id', userId)
                .eq('type', type)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                throw error;
            }

            return {
                success: true,
                notifications: notifications || [],
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit),
                    hasNext: page < Math.ceil(count / limit),
                    hasPrev: page > 1
                }
            };

        } catch (error) {
            console.error('Get notifications by type error:', error);
            throw new Error('Failed to get notifications by type');
        }
    }

    // Clean up old notifications (cleanup job)
    async cleanupOldNotifications(daysOld = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const { data, error } = await supabase
                .from('notifications')
                .delete()
                .eq('is_read', true)
                .lt('created_at', cutoffDate.toISOString());

            if (error) {
                throw error;
            }

            console.log(`🧹 Cleaned up old notifications: ${data?.length || 0} deleted`);

            return {
                success: true,
                deleted_count: data?.length || 0
            };

        } catch (error) {
            console.error('Cleanup old notifications error:', error);
            throw new Error('Failed to cleanup old notifications');
        }
    }
}

const notificationService = new NotificationService();
module.exports = { notificationService };
