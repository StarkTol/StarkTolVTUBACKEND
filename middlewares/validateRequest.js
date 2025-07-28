const { validateEmail, validatePassword, validatePhoneNumber } = require('../utils/validators');
const { generateResponse } = require('../utils/helpers');

const validationRules = {
    register: (data) => {
        const errors = [];
        
        if (!data.email) {
            errors.push('Email is required');
        } else if (!validateEmail(data.email)) {
            errors.push('Invalid email format');
        }

        if (!data.password) {
            errors.push('Password is required');
        } else if (!validatePassword(data.password)) {
            errors.push('Password must be at least 8 characters long');
        }

        if (!data.full_name) {
            errors.push('Full name is required');
        } else if (data.full_name.length < 2) {
            errors.push('Full name must be at least 2 characters long');
        }

        if (!data.phone) {
            errors.push('Phone number is required');
        } else if (!validatePhoneNumber(data.phone)) {
            errors.push('Invalid phone number format');
        }

        return errors;
    },

    login: (data) => {
        const errors = [];
        
        if (!data.email) {
            errors.push('Email is required');
        } else if (!validateEmail(data.email)) {
            errors.push('Invalid email format');
        }

        if (!data.password) {
            errors.push('Password is required');
        }

        return errors;
    },

    updateProfile: (data) => {
        const errors = [];
        
        if (!data.full_name) {
            errors.push('Full name is required');
        } else if (data.full_name.length < 2) {
            errors.push('Full name must be at least 2 characters long');
        }

        // Email is optional in profile updates
        if (data.email && !validateEmail(data.email)) {
            errors.push('Invalid email format');
        }

        if (!data.phone) {
            errors.push('Phone number is required');
        } else if (!validatePhoneNumber(data.phone)) {
            errors.push('Invalid phone number format');
        }

        return errors;
    },

    changePassword: (data) => {
        const errors = [];
        
        if (!data.current_password) {
            errors.push('Current password is required');
        }

        if (!data.new_password) {
            errors.push('New password is required');
        } else if (!validatePassword(data.new_password)) {
            errors.push('New password must be at least 8 characters long');
        }

        return errors;
    },

    deposit: (data) => {
        const errors = [];
        
        if (!data.amount) {
            errors.push('Amount is required');
        } else if (isNaN(data.amount) || parseFloat(data.amount) <= 0) {
            errors.push('Amount must be a positive number');
        } else if (parseFloat(data.amount) < 100) {
            errors.push('Minimum deposit amount is ₦100');
        }

        if (!data.payment_method) {
            errors.push('Payment method is required');
        }

        if (!data.payment_reference) {
            errors.push('Payment reference is required');
        }

        return errors;
    },

    withdraw: (data) => {
        const errors = [];
        
        if (!data.amount) {
            errors.push('Amount is required');
        } else if (isNaN(data.amount) || parseFloat(data.amount) <= 0) {
            errors.push('Amount must be a positive number');
        }

        if (!data.bank_account) {
            errors.push('Bank account number is required');
        }

        if (!data.bank_name) {
            errors.push('Bank name is required');
        }

        if (!data.account_name) {
            errors.push('Account name is required');
        }

        return errors;
    },

    transfer: (data) => {
        const errors = [];
        
        if (!data.recipient_email) {
            errors.push('Recipient email is required');
        } else if (!validateEmail(data.recipient_email)) {
            errors.push('Invalid recipient email format');
        }

        if (!data.amount) {
            errors.push('Amount is required');
        } else if (isNaN(data.amount) || parseFloat(data.amount) <= 0) {
            errors.push('Amount must be a positive number');
        }

        return errors;
    },

    purchaseAirtime: (data) => {
        const errors = [];
        
        if (!data.network) {
            errors.push('Network is required');
        }

        if (!data.phone_number) {
            errors.push('Phone number is required');
        } else if (!validatePhoneNumber(data.phone_number)) {
            errors.push('Invalid phone number format');
        }

        if (!data.amount) {
            errors.push('Amount is required');
        } else if (isNaN(data.amount) || parseFloat(data.amount) <= 0) {
            errors.push('Amount must be a positive number');
        } else if (parseFloat(data.amount) < 50) {
            errors.push('Minimum airtime purchase is ₦50');
        }

        return errors;
    },

    purchaseData: (data) => {
        const errors = [];
        
        if (!data.network) {
            errors.push('Network is required');
        }

        if (!data.phone_number) {
            errors.push('Phone number is required');
        } else if (!validatePhoneNumber(data.phone_number)) {
            errors.push('Invalid phone number format');
        }

        if (!data.plan_id) {
            errors.push('Data plan is required');
        }

        if (!data.amount) {
            errors.push('Amount is required');
        } else if (isNaN(data.amount) || parseFloat(data.amount) <= 0) {
            errors.push('Amount must be a positive number');
        }

        return errors;
    },

    purchaseCable: (data) => {
        const errors = [];
        
        if (!data.provider) {
            errors.push('Cable provider is required');
        }

        if (!data.package_id) {
            errors.push('Cable package is required');
        }

        if (!data.smartcard_number) {
            errors.push('Smartcard number is required');
        }

        if (!data.amount) {
            errors.push('Amount is required');
        } else if (isNaN(data.amount) || parseFloat(data.amount) <= 0) {
            errors.push('Amount must be a positive number');
        }

        return errors;
    },

    purchaseElectricity: (data) => {
        const errors = [];
        
        if (!data.provider) {
            errors.push('Electricity provider is required');
        }

        if (!data.meter_number) {
            errors.push('Meter number is required');
        }

        if (!data.meter_type) {
            errors.push('Meter type is required');
        }

        if (!data.amount) {
            errors.push('Amount is required');
        } else if (isNaN(data.amount) || parseFloat(data.amount) <= 0) {
            errors.push('Amount must be a positive number');
        } else if (parseFloat(data.amount) < 100) {
            errors.push('Minimum electricity purchase is ₦100');
        }

        return errors;
    },

    resellerApplication: (data) => {
        const errors = [];
        
        if (!data.business_name) {
            errors.push('Business name is required');
        }

        if (!data.business_address) {
            errors.push('Business address is required');
        }

        if (!data.business_phone) {
            errors.push('Business phone is required');
        } else if (!validatePhoneNumber(data.business_phone)) {
            errors.push('Invalid business phone format');
        }

        return errors;
    },

    createSubReseller: (data) => {
        const errors = [];
        
        if (!data.user_email) {
            errors.push('User email is required');
        } else if (!validateEmail(data.user_email)) {
            errors.push('Invalid user email format');
        }

        if (!data.commission_percentage) {
            errors.push('Commission percentage is required');
        } else if (isNaN(data.commission_percentage) || parseFloat(data.commission_percentage) < 0 || parseFloat(data.commission_percentage) > 50) {
            errors.push('Commission percentage must be between 0 and 50');
        }

        return errors;
    },

    updateCommission: (data) => {
        const errors = [];
        
        if (!data.commission_percentage) {
            errors.push('Commission percentage is required');
        } else if (isNaN(data.commission_percentage) || parseFloat(data.commission_percentage) < 0 || parseFloat(data.commission_percentage) > 50) {
            errors.push('Commission percentage must be between 0 and 50');
        }

        return errors;
    },

    createTicket: (data) => {
        const errors = [];
        
        if (!data.subject) {
            errors.push('Subject is required');
        } else if (data.subject.length < 5) {
            errors.push('Subject must be at least 5 characters long');
        }

        if (!data.message) {
            errors.push('Message is required');
        } else if (data.message.length < 10) {
            errors.push('Message must be at least 10 characters long');
        }

        if (!data.category) {
            errors.push('Category is required');
        }

        const validCategories = ['technical', 'billing', 'vtu_services', 'account', 'general'];
        if (data.category && !validCategories.includes(data.category)) {
            errors.push('Invalid category');
        }

        return errors;
    },

    replyToTicket: (data) => {
        const errors = [];
        
        if (!data.message) {
            errors.push('Message is required');
        } else if (data.message.length < 5) {
            errors.push('Message must be at least 5 characters long');
        }

        return errors;
    },

    rateTicket: (data) => {
        const errors = [];
        
        if (!data.rating) {
            errors.push('Rating is required');
        } else if (isNaN(data.rating) || parseInt(data.rating) < 1 || parseInt(data.rating) > 5) {
            errors.push('Rating must be between 1 and 5');
        }

        return errors;
    },

    processReferralBonus: (data) => {
        const errors = [];
        
        if (!data.transaction_id) {
            errors.push('Transaction ID is required');
        }

        return errors;
    },

    withdrawReferralEarnings: (data) => {
        const errors = [];
        
        if (!data.amount) {
            errors.push('Amount is required');
        } else if (isNaN(data.amount) || parseFloat(data.amount) <= 0) {
            errors.push('Amount must be a positive number');
        }

        return errors;
    },

    userPreferences: (data) => {
        const errors = [];
        
        const validLanguages = ['en', 'fr', 'ha', 'ig', 'yo'];
        const validTimezones = ['Africa/Lagos', 'UTC'];
        const validCurrencies = ['NGN'];

        if (data.language && !validLanguages.includes(data.language)) {
            errors.push('Invalid language selection');
        }

        if (data.timezone && !validTimezones.includes(data.timezone)) {
            errors.push('Invalid timezone selection');
        }

        if (data.currency && !validCurrencies.includes(data.currency)) {
            errors.push('Invalid currency selection');
        }

        return errors;
    },

    securitySettings: (data) => {
        const errors = [];
        
        if (data.session_timeout && (isNaN(data.session_timeout) || parseInt(data.session_timeout) < 5 || parseInt(data.session_timeout) > 120)) {
            errors.push('Session timeout must be between 5 and 120 minutes');
        }

        return errors;
    },

    webhookSettings: (data) => {
        const errors = [];
        
        if (data.webhook_url && data.is_active) {
            try {
                new URL(data.webhook_url);
            } catch {
                errors.push('Invalid webhook URL format');
            }
        }

        if (data.events && !Array.isArray(data.events)) {
            errors.push('Events must be an array');
        }

        return errors;
    },

    configureSubdomain: (data) => {
        const errors = [];
        
        if (data.subdomain) {
            const subdomainRegex = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
            if (!subdomainRegex.test(data.subdomain)) {
                errors.push('Invalid subdomain format. Use only lowercase letters, numbers, and hyphens');
            }
        }

        if (data.custom_domain) {
            const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
            if (!domainRegex.test(data.custom_domain)) {
                errors.push('Invalid custom domain format');
            }
        }

        return errors;
    },

    verifyDomain: (data) => {
        const errors = [];
        
        if (!data.domain) {
            errors.push('Domain is required');
        }

        return errors;
    },

    updateBranding: (data) => {
        const errors = [];
        
        if (!data.branding || typeof data.branding !== 'object') {
            errors.push('Valid branding configuration is required');
        }

        return errors;
    }
};

const validateRequest = (ruleName) => {
    return (req, res, next) => {
        try {
            const rule = validationRules[ruleName];
            
            if (!rule) {
                console.error(`Validation rule '${ruleName}' not found`);
                return next();
            }

            const errors = rule(req.body);
            
            if (errors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors
                });
            }

            next();
        } catch (error) {
            console.error('Validation middleware error:', error);
            return res.status(500).json({
                success: false,
                message: 'Validation error occurred'
            });
        }
    };
};

module.exports = { validateRequest };
