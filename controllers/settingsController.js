const { supabase, supabaseAdmin } = require('../config/supabase');
const { generateResponse } = require('../utils/helpers');

class SettingsController {
    // Get platform settings (public)
    async getPlatformSettings(req, res) {
        try {
            const { data: settings, error } = await supabase
                .from('platform_settings')
                .select('key, value, is_public')
                .eq('is_public', true);

            if (error) {
                return res.status(500).json(generateResponse(false, 'Failed to retrieve platform settings'));
            }

            // Convert array to object for easier access
            const settingsObject = {};
            settings.forEach(setting => {
                settingsObject[setting.key] = setting.value;
            });

            res.json(generateResponse(true, 'Platform settings retrieved successfully', settingsObject));

        } catch (error) {
            console.error('Get platform settings error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get user preferences
    async getUserPreferences(req, res) {
        try {
            const userId = req.user.id;

            const { data: preferences, error } = await supabase
                .from('user_preferences')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
                return res.status(500).json(generateResponse(false, 'Failed to retrieve user preferences'));
            }

            // Return default preferences if none exist
            const defaultPreferences = {
                email_notifications: true,
                sms_notifications: true,
                transaction_alerts: true,
                marketing_emails: false,
                language: 'en',
                timezone: 'Africa/Lagos',
                currency: 'NGN'
            };

            const userPreferences = preferences || defaultPreferences;

            res.json(generateResponse(true, 'User preferences retrieved successfully', userPreferences));

        } catch (error) {
            console.error('Get user preferences error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Update user preferences
    async updateUserPreferences(req, res) {
        try {
            const userId = req.user.id;
            const {
                email_notifications,
                sms_notifications,
                transaction_alerts,
                marketing_emails,
                language,
                timezone,
                currency
            } = req.body;

            // Validate inputs
            const validLanguages = ['en', 'fr', 'ha', 'ig', 'yo'];
            const validTimezones = ['Africa/Lagos', 'UTC'];
            const validCurrencies = ['NGN'];

            if (language && !validLanguages.includes(language)) {
                return res.status(400).json(generateResponse(false, 'Invalid language selection'));
            }

            if (timezone && !validTimezones.includes(timezone)) {
                return res.status(400).json(generateResponse(false, 'Invalid timezone selection'));
            }

            if (currency && !validCurrencies.includes(currency)) {
                return res.status(400).json(generateResponse(false, 'Invalid currency selection'));
            }

            const preferencesData = {
                user_id: userId,
                email_notifications: email_notifications !== undefined ? email_notifications : true,
                sms_notifications: sms_notifications !== undefined ? sms_notifications : true,
                transaction_alerts: transaction_alerts !== undefined ? transaction_alerts : true,
                marketing_emails: marketing_emails !== undefined ? marketing_emails : false,
                language: language || 'en',
                timezone: timezone || 'Africa/Lagos',
                currency: currency || 'NGN',
                updated_at: new Date().toISOString()
            };

            const { data: preferences, error } = await supabase
                .from('user_preferences')
                .upsert(preferencesData)
                .select()
                .single();

            if (error) {
                return res.status(500).json(generateResponse(false, 'Failed to update user preferences'));
            }

            res.json(generateResponse(true, 'User preferences updated successfully', preferences));

        } catch (error) {
            console.error('Update user preferences error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get API settings for resellers
    async getAPISettings(req, res) {
        try {
            const userId = req.user.id;

            // Check if user is a reseller
            const { data: resellerData, error: resellerError } = await supabase
                .from('resellers')
                .select('id, status')
                .eq('user_id', userId)
                .eq('status', 'approved')
                .single();

            if (resellerError || !resellerData) {
                return res.status(403).json(generateResponse(false, 'Access denied. API access is only available for approved resellers'));
            }

            // Get or create API credentials
            const { data: apiSettings, error: apiError } = await supabase
                .from('api_credentials')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (apiError && apiError.code === 'PGRST116') {
                // Create new API credentials
                const apiKey = `stk_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
                const secretKey = `sks_${Date.now()}_${Math.random().toString(36).substr(2, 32)}`;

                const { data: newApiSettings, error: createError } = await supabase
                    .from('api_credentials')
                    .insert({
                        user_id: userId,
                        api_key: apiKey,
                        secret_key: secretKey,
                        is_active: true,
                        rate_limit: 1000, // requests per hour
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (createError) {
                    return res.status(500).json(generateResponse(false, 'Failed to create API credentials'));
                }

                return res.json(generateResponse(true, 'API settings retrieved successfully', newApiSettings));
            } else if (apiError) {
                return res.status(500).json(generateResponse(false, 'Failed to retrieve API settings'));
            }

            res.json(generateResponse(true, 'API settings retrieved successfully', apiSettings));

        } catch (error) {
            console.error('Get API settings error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Regenerate API credentials
    async regenerateAPICredentials(req, res) {
        try {
            const userId = req.user.id;

            // Check if user is a reseller
            const { data: resellerData, error: resellerError } = await supabase
                .from('resellers')
                .select('id, status')
                .eq('user_id', userId)
                .eq('status', 'approved')
                .single();

            if (resellerError || !resellerData) {
                return res.status(403).json(generateResponse(false, 'Access denied. API access is only available for approved resellers'));
            }

            // Generate new credentials
            const apiKey = `stk_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
            const secretKey = `sks_${Date.now()}_${Math.random().toString(36).substr(2, 32)}`;

            const { data: apiSettings, error } = await supabase
                .from('api_credentials')
                .update({
                    api_key: apiKey,
                    secret_key: secretKey,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                return res.status(500).json(generateResponse(false, 'Failed to regenerate API credentials'));
            }

            res.json(generateResponse(true, 'API credentials regenerated successfully', apiSettings));

        } catch (error) {
            console.error('Regenerate API credentials error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get webhook settings
    async getWebhookSettings(req, res) {
        try {
            const userId = req.user.id;

            // Check if user is a reseller
            const { data: resellerData, error: resellerError } = await supabase
                .from('resellers')
                .select('id, status')
                .eq('user_id', userId)
                .eq('status', 'approved')
                .single();

            if (resellerError || !resellerData) {
                return res.status(403).json(generateResponse(false, 'Access denied. Webhook settings are only available for approved resellers'));
            }

            const { data: webhookSettings, error } = await supabase
                .from('webhook_settings')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                return res.status(500).json(generateResponse(false, 'Failed to retrieve webhook settings'));
            }

            // Return default settings if none exist
            const defaultSettings = {
                webhook_url: '',
                is_active: false,
                events: ['transaction.completed', 'transaction.failed'],
                secret: ''
            };

            const settings = webhookSettings || defaultSettings;

            res.json(generateResponse(true, 'Webhook settings retrieved successfully', settings));

        } catch (error) {
            console.error('Get webhook settings error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Update webhook settings
    async updateWebhookSettings(req, res) {
        try {
            const userId = req.user.id;
            const { webhook_url, is_active, events } = req.body;

            // Check if user is a reseller
            const { data: resellerData, error: resellerError } = await supabase
                .from('resellers')
                .select('id, status')
                .eq('user_id', userId)
                .eq('status', 'approved')
                .single();

            if (resellerError || !resellerData) {
                return res.status(403).json(generateResponse(false, 'Access denied. Webhook settings are only available for approved resellers'));
            }

            // Validate webhook URL if provided
            if (webhook_url && is_active) {
                try {
                    new URL(webhook_url);
                } catch {
                    return res.status(400).json(generateResponse(false, 'Invalid webhook URL'));
                }
            }

            // Validate events
            const validEvents = [
                'transaction.completed',
                'transaction.failed',
                'wallet.credited',
                'wallet.debited',
                'user.registered'
            ];

            if (events && !Array.isArray(events)) {
                return res.status(400).json(generateResponse(false, 'Events must be an array'));
            }

            if (events) {
                const invalidEvents = events.filter(event => !validEvents.includes(event));
                if (invalidEvents.length > 0) {
                    return res.status(400).json(generateResponse(false, `Invalid events: ${invalidEvents.join(', ')}`));
                }
            }

            // Generate webhook secret if not exists
            let webhookSecret = '';
            if (is_active) {
                const { data: existingSettings } = await supabase
                    .from('webhook_settings')
                    .select('secret')
                    .eq('user_id', userId)
                    .single();

                webhookSecret = existingSettings?.secret || `whsec_${Math.random().toString(36).substr(2, 32)}`;
            }

            const webhookData = {
                user_id: userId,
                webhook_url: webhook_url || '',
                is_active: is_active || false,
                events: events || ['transaction.completed', 'transaction.failed'],
                secret: webhookSecret,
                updated_at: new Date().toISOString()
            };

            const { data: settings, error } = await supabase
                .from('webhook_settings')
                .upsert(webhookData)
                .select()
                .single();

            if (error) {
                return res.status(500).json(generateResponse(false, 'Failed to update webhook settings'));
            }

            res.json(generateResponse(true, 'Webhook settings updated successfully', settings));

        } catch (error) {
            console.error('Update webhook settings error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Test webhook endpoint
    async testWebhook(req, res) {
        try {
            const userId = req.user.id;

            // Check if user is a reseller
            const { data: resellerData, error: resellerError } = await supabase
                .from('resellers')
                .select('id, status')
                .eq('user_id', userId)
                .eq('status', 'approved')
                .single();

            if (resellerError || !resellerData) {
                return res.status(403).json(generateResponse(false, 'Access denied. Webhook testing is only available for approved resellers'));
            }

            const { data: webhookSettings, error } = await supabase
                .from('webhook_settings')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .single();

            if (error || !webhookSettings) {
                return res.status(400).json(generateResponse(false, 'No active webhook configuration found'));
            }

            // Send test webhook (in a real implementation, you'd use a proper HTTP client)
            const testPayload = {
                event: 'webhook.test',
                data: {
                    message: 'This is a test webhook from StarkTol',
                    timestamp: new Date().toISOString(),
                    user_id: userId
                }
            };

            // Log webhook test attempt
            await supabase
                .from('webhook_logs')
                .insert({
                    user_id: userId,
                    event: 'webhook.test',
                    payload: testPayload,
                    webhook_url: webhookSettings.webhook_url,
                    status: 'sent',
                    created_at: new Date().toISOString()
                });

            res.json(generateResponse(true, 'Test webhook sent successfully', {
                webhook_url: webhookSettings.webhook_url,
                test_payload: testPayload
            }));

        } catch (error) {
            console.error('Test webhook error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get security settings
    async getSecuritySettings(req, res) {
        try {
            const userId = req.user.id;

            const { data: securitySettings, error } = await supabase
                .from('user_security_settings')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                return res.status(500).json(generateResponse(false, 'Failed to retrieve security settings'));
            }

            // Return default settings if none exist
            const defaultSettings = {
                two_factor_enabled: false,
                login_notifications: true,
                transaction_pin_enabled: false,
                session_timeout: 30 // minutes
            };

            const settings = securitySettings || defaultSettings;

            res.json(generateResponse(true, 'Security settings retrieved successfully', settings));

        } catch (error) {
            console.error('Get security settings error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Update security settings
    async updateSecuritySettings(req, res) {
        try {
            const userId = req.user.id;
            const {
                two_factor_enabled,
                login_notifications,
                transaction_pin_enabled,
                session_timeout
            } = req.body;

            // Validate session timeout
            if (session_timeout && (session_timeout < 5 || session_timeout > 120)) {
                return res.status(400).json(generateResponse(false, 'Session timeout must be between 5 and 120 minutes'));
            }

            const securityData = {
                user_id: userId,
                two_factor_enabled: two_factor_enabled !== undefined ? two_factor_enabled : false,
                login_notifications: login_notifications !== undefined ? login_notifications : true,
                transaction_pin_enabled: transaction_pin_enabled !== undefined ? transaction_pin_enabled : false,
                session_timeout: session_timeout || 30,
                updated_at: new Date().toISOString()
            };

            const { data: settings, error } = await supabase
                .from('user_security_settings')
                .upsert(securityData)
                .select()
                .single();

            if (error) {
                return res.status(500).json(generateResponse(false, 'Failed to update security settings'));
            }

            res.json(generateResponse(true, 'Security settings updated successfully', settings));

        } catch (error) {
            console.error('Update security settings error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }
}

module.exports = new SettingsController();
