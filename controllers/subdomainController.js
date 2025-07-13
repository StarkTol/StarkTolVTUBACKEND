const { supabase } = require('../config/supabase');
const { generateResponse } = require('../utils/helpers');

class SubdomainController {
    // Get subdomain information for a reseller
    async getSubdomainInfo(req, res) {
        try {
            const userId = req.user.id;

            // Check if user is a reseller
            const { data: resellerData, error: resellerError } = await supabase
                .from('resellers')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'approved')
                .single();

            if (resellerError || !resellerData) {
                return res.status(403).json(generateResponse(false, 'Access denied. Subdomain management is only available for approved resellers'));
            }

            // Get subdomain configuration
            const { data: subdomainData, error: subdomainError } = await supabase
                .from('subdomain_configs')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (subdomainError && subdomainError.code !== 'PGRST116') {
                return res.status(500).json(generateResponse(false, 'Failed to retrieve subdomain information'));
            }

            const subdomainInfo = {
                has_subdomain: !!subdomainData,
                subdomain: subdomainData?.subdomain || null,
                custom_domain: subdomainData?.custom_domain || null,
                is_active: subdomainData?.is_active || false,
                ssl_enabled: subdomainData?.ssl_enabled || false,
                branding: subdomainData?.branding || {},
                created_at: subdomainData?.created_at || null
            };

            res.json(generateResponse(true, 'Subdomain information retrieved successfully', subdomainInfo));

        } catch (error) {
            console.error('Get subdomain info error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Create or update subdomain configuration
    async configureSubdomain(req, res) {
        try {
            const userId = req.user.id;
            const { subdomain, custom_domain, branding } = req.body;

            // Check if user is a reseller
            const { data: resellerData, error: resellerError } = await supabase
                .from('resellers')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'approved')
                .single();

            if (resellerError || !resellerData) {
                return res.status(403).json(generateResponse(false, 'Access denied. Subdomain management is only available for approved resellers'));
            }

            // Validate subdomain format
            if (subdomain) {
                const subdomainRegex = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
                if (!subdomainRegex.test(subdomain)) {
                    return res.status(400).json(generateResponse(false, 'Invalid subdomain format. Use only lowercase letters, numbers, and hyphens'));
                }

                // Check if subdomain is already taken
                const { data: existingSubdomain } = await supabase
                    .from('subdomain_configs')
                    .select('user_id')
                    .eq('subdomain', subdomain)
                    .neq('user_id', userId)
                    .single();

                if (existingSubdomain) {
                    return res.status(400).json(generateResponse(false, 'Subdomain is already taken'));
                }

                // Check against reserved subdomains
                const reservedSubdomains = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'support', 'help'];
                if (reservedSubdomains.includes(subdomain.toLowerCase())) {
                    return res.status(400).json(generateResponse(false, 'Subdomain is reserved and cannot be used'));
                }
            }

            // Validate custom domain format
            if (custom_domain) {
                const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
                if (!domainRegex.test(custom_domain)) {
                    return res.status(400).json(generateResponse(false, 'Invalid custom domain format'));
                }
            }

            // Validate branding configuration
            if (branding) {
                const validBrandingKeys = [
                    'logo_url', 'favicon_url', 'primary_color', 'secondary_color',
                    'company_name', 'support_email', 'support_phone', 'terms_url', 'privacy_url'
                ];

                const invalidKeys = Object.keys(branding).filter(key => !validBrandingKeys.includes(key));
                if (invalidKeys.length > 0) {
                    return res.status(400).json(generateResponse(false, `Invalid branding keys: ${invalidKeys.join(', ')}`));
                }

                // Validate URLs
                const urlFields = ['logo_url', 'favicon_url', 'terms_url', 'privacy_url'];
                for (const field of urlFields) {
                    if (branding[field]) {
                        try {
                            new URL(branding[field]);
                        } catch {
                            return res.status(400).json(generateResponse(false, `Invalid URL format for ${field}`));
                        }
                    }
                }

                // Validate color codes
                const colorFields = ['primary_color', 'secondary_color'];
                const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
                for (const field of colorFields) {
                    if (branding[field] && !colorRegex.test(branding[field])) {
                        return res.status(400).json(generateResponse(false, `Invalid color format for ${field}. Use hex format (e.g., #FF0000)`));
                    }
                }
            }

            const subdomainConfig = {
                user_id: userId,
                subdomain: subdomain || null,
                custom_domain: custom_domain || null,
                branding: branding || {},
                is_active: true,
                ssl_enabled: false, // Will be enabled after DNS verification
                updated_at: new Date().toISOString()
            };

            const { data: configData, error } = await supabase
                .from('subdomain_configs')
                .upsert(subdomainConfig)
                .select()
                .single();

            if (error) {
                return res.status(500).json(generateResponse(false, 'Failed to configure subdomain'));
            }

            // Create DNS verification record for custom domain
            if (custom_domain) {
                const verificationToken = `stk-verify-${Math.random().toString(36).substr(2, 16)}`;
                
                await supabase
                    .from('domain_verifications')
                    .upsert({
                        user_id: userId,
                        domain: custom_domain,
                        verification_token: verificationToken,
                        verification_type: 'TXT',
                        is_verified: false,
                        created_at: new Date().toISOString()
                    });

                configData.verification_token = verificationToken;
                configData.verification_instructions = {
                    type: 'TXT',
                    name: `_stk-verification.${custom_domain}`,
                    value: verificationToken,
                    instructions: 'Add this TXT record to your domain\'s DNS settings'
                };
            }

            res.json(generateResponse(true, 'Subdomain configured successfully', configData));

        } catch (error) {
            console.error('Configure subdomain error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Verify custom domain
    async verifyCustomDomain(req, res) {
        try {
            const userId = req.user.id;
            const { domain } = req.body;

            if (!domain) {
                return res.status(400).json(generateResponse(false, 'Domain is required'));
            }

            // Check if user owns this domain verification
            const { data: verificationData, error: verificationError } = await supabase
                .from('domain_verifications')
                .select('*')
                .eq('user_id', userId)
                .eq('domain', domain)
                .single();

            if (verificationError || !verificationData) {
                return res.status(404).json(generateResponse(false, 'Domain verification not found'));
            }

            if (verificationData.is_verified) {
                return res.status(400).json(generateResponse(false, 'Domain is already verified'));
            }

            // In a real implementation, you would perform DNS lookup to verify the TXT record
            // For now, we'll simulate the verification process
            const isVerified = Math.random() > 0.3; // 70% success rate for demo

            if (isVerified) {
                // Mark domain as verified
                await supabase
                    .from('domain_verifications')
                    .update({
                        is_verified: true,
                        verified_at: new Date().toISOString()
                    })
                    .eq('id', verificationData.id);

                // Enable SSL for the domain
                await supabase
                    .from('subdomain_configs')
                    .update({
                        ssl_enabled: true,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', userId);

                res.json(generateResponse(true, 'Domain verified successfully', {
                    domain,
                    verified: true,
                    ssl_enabled: true
                }));
            } else {
                res.status(400).json(generateResponse(false, 'Domain verification failed. Please ensure the TXT record is properly configured'));
            }

        } catch (error) {
            console.error('Verify custom domain error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get subdomain analytics
    async getSubdomainAnalytics(req, res) {
        try {
            const userId = req.user.id;
            const { period = '30' } = req.query; // days

            // Check if user is a reseller with subdomain
            const { data: subdomainData, error: subdomainError } = await supabase
                .from('subdomain_configs')
                .select('subdomain, custom_domain')
                .eq('user_id', userId)
                .eq('is_active', true)
                .single();

            if (subdomainError || !subdomainData) {
                return res.status(404).json(generateResponse(false, 'No active subdomain configuration found'));
            }

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(period));

            // Get subdomain traffic analytics
            const { data: analyticsData, error: analyticsError } = await supabase
                .from('subdomain_analytics')
                .select('*')
                .eq('user_id', userId)
                .gte('date', startDate.toISOString().split('T')[0])
                .order('date', { ascending: true });

            if (analyticsError) {
                console.error('Analytics error:', analyticsError);
            }

            // Calculate summary statistics
            const analytics = {
                subdomain: subdomainData.subdomain,
                custom_domain: subdomainData.custom_domain,
                period_days: parseInt(period),
                total_visits: 0,
                unique_visitors: 0,
                total_transactions: 0,
                conversion_rate: 0,
                daily_data: analyticsData || []
            };

            if (analyticsData && analyticsData.length > 0) {
                analytics.total_visits = analyticsData.reduce((sum, day) => sum + (day.visits || 0), 0);
                analytics.unique_visitors = analyticsData.reduce((sum, day) => sum + (day.unique_visitors || 0), 0);
                analytics.total_transactions = analyticsData.reduce((sum, day) => sum + (day.transactions || 0), 0);
                
                if (analytics.total_visits > 0) {
                    analytics.conversion_rate = ((analytics.total_transactions / analytics.total_visits) * 100).toFixed(2);
                }
            }

            res.json(generateResponse(true, 'Subdomain analytics retrieved successfully', analytics));

        } catch (error) {
            console.error('Get subdomain analytics error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Update branding configuration
    async updateBranding(req, res) {
        try {
            const userId = req.user.id;
            const { branding } = req.body;

            if (!branding || typeof branding !== 'object') {
                return res.status(400).json(generateResponse(false, 'Valid branding configuration is required'));
            }

            // Check if user has subdomain configuration
            const { data: subdomainData, error: subdomainError } = await supabase
                .from('subdomain_configs')
                .select('id, branding')
                .eq('user_id', userId)
                .single();

            if (subdomainError || !subdomainData) {
                return res.status(404).json(generateResponse(false, 'Subdomain configuration not found'));
            }

            // Merge existing branding with new updates
            const updatedBranding = {
                ...subdomainData.branding,
                ...branding
            };

            const { data: updatedConfig, error } = await supabase
                .from('subdomain_configs')
                .update({
                    branding: updatedBranding,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                return res.status(500).json(generateResponse(false, 'Failed to update branding configuration'));
            }

            res.json(generateResponse(true, 'Branding configuration updated successfully', updatedConfig));

        } catch (error) {
            console.error('Update branding error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Deactivate subdomain
    async deactivateSubdomain(req, res) {
        try {
            const userId = req.user.id;

            const { data: subdomainData, error } = await supabase
                .from('subdomain_configs')
                .update({
                    is_active: false,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                return res.status(500).json(generateResponse(false, 'Failed to deactivate subdomain'));
            }

            if (!subdomainData) {
                return res.status(404).json(generateResponse(false, 'Subdomain configuration not found'));
            }

            res.json(generateResponse(true, 'Subdomain deactivated successfully'));

        } catch (error) {
            console.error('Deactivate subdomain error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get subdomain by name (public endpoint for subdomain resolution)
    async resolveSubdomain(req, res) {
        try {
            const { subdomain } = req.params;

            if (!subdomain) {
                return res.status(400).json(generateResponse(false, 'Subdomain is required'));
            }

            const { data: subdomainData, error } = await supabase
                .from('subdomain_configs')
                .select(`
                    *,
                    resellers!inner(
                        business_name,
                        users!inner(full_name, email)
                    )
                `)
                .eq('subdomain', subdomain)
                .eq('is_active', true)
                .single();

            if (error || !subdomainData) {
                return res.status(404).json(generateResponse(false, 'Subdomain not found'));
            }

            // Return public subdomain information
            const publicInfo = {
                subdomain: subdomainData.subdomain,
                business_name: subdomainData.resellers.business_name,
                branding: subdomainData.branding,
                ssl_enabled: subdomainData.ssl_enabled,
                contact_email: subdomainData.branding.support_email || subdomainData.resellers.users.email
            };

            res.json(generateResponse(true, 'Subdomain resolved successfully', publicInfo));

        } catch (error) {
            console.error('Resolve subdomain error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }
}

module.exports = new SubdomainController();
