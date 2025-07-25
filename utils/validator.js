/**
 * Joi Schema Validation for VTU Platform
 * Comprehensive validation schemas for all API endpoints
 */
const Joi = require('joi');

// ===== USER SCHEMAS =====
const userRegistrationSchema = Joi.object({
    firstName: Joi.string().min(2).max(50).pattern(/^[a-zA-Z\s]+$/).required(),
    lastName: Joi.string().min(2).max(50).pattern(/^[a-zA-Z\s]+$/).required(),
    email: Joi.string().email().lowercase().required(),
    phone: Joi.string().pattern(/^(\+234|234|0)?[789]\d{9}$/).required(),
    password: Joi.string()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/) 
        .required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
    referralCode: Joi.string().alphanum().length(8).optional(),
    termsAccepted: Joi.boolean().valid(true).required()
});

const userLoginSchema = Joi.object({
    email: Joi.string().email().lowercase().required(),
    password: Joi.string().min(8).required()
});

const userProfileSchema = Joi.object({
    firstName: Joi.string().min(2).max(50).pattern(/^[a-zA-Z\s]+$/),
    lastName: Joi.string().min(2).max(50).pattern(/^[a-zA-Z\s]+$/),
    phone: Joi.string().pattern(/^(\+234|234|0)?[789]\d{9}$/),
    dateOfBirth: Joi.date().max('now').min('1900-01-01'),
    address: Joi.object({
        street: Joi.string().max(200),
        city: Joi.string().max(100),
        state: Joi.string().max(100),
        postalCode: Joi.string().pattern(/^\d{6}$/),
        country: Joi.string().default('Nigeria')
    })
});

// ===== VTU TRANSACTION SCHEMAS =====
const airtimeTopupSchema = Joi.object({
    network: Joi.string().valid('mtn', 'glo', 'airtel', '9mobile').required(),
    phoneNumber: Joi.string().pattern(/^(\+234|234|0)?[789]\d{9}$/).required(),
    amount: Joi.number().min(50).max(50000).required(),
    transactionPin: Joi.string().length(4).pattern(/^\d{4}$/)
});

const dataTopupSchema = Joi.object({
    network: Joi.string().valid('mtn', 'glo', 'airtel', '9mobile').required(),
    phoneNumber: Joi.string().pattern(/^(\+234|234|0)?[789]\d{9}$/).required(),
    planId: Joi.string().required(),
    transactionPin: Joi.string().length(4).pattern(/^\d{4}$/)
});

const electricityBillSchema = Joi.object({
    provider: Joi.string().valid('aedc', 'ekedc', 'ikeja', 'ibadan', 'jos', 'kaduna', 'kano', 'portharcourt', 'yola', 'benin').required(),
    meterNumber: Joi.string().pattern(/^\d{11,13}$/).required(),
    meterType: Joi.string().valid('prepaid', 'postpaid').required(),
    amount: Joi.number().min(1000).max(500000).required(),
    transactionPin: Joi.string().length(4).pattern(/^\d{4}$/),
    customerName: Joi.string().max(100),
    customerAddress: Joi.string().max(200)
});

const cableTvSchema = Joi.object({
    provider: Joi.string().valid('dstv', 'gotv', 'startimes', 'showmax').required(),
    smartCardNumber: Joi.string().pattern(/^\d{10,12}$/).required(),
    packageCode: Joi.string().required(),
    customerName: Joi.string().max(100),
    transactionPin: Joi.string().length(4).pattern(/^\d{4}$/)
});

// ===== WALLET SCHEMAS =====
const walletFundingSchema = Joi.object({
    amount: Joi.number().min(100).max(1000000).required(),
    paymentMethod: Joi.string().valid('bank_transfer', 'card', 'ussd').required(),
    reference: Joi.string().alphanum().max(50)
});

const walletTransferSchema = Joi.object({
    recipientEmail: Joi.string().email().required(),
    amount: Joi.number().min(100).max(100000).required(),
    transactionPin: Joi.string().length(4).pattern(/^\d{4}$/).required(),
    description: Joi.string().max(200).optional()
});

const setTransactionPinSchema = Joi.object({
    pin: Joi.string().length(4).pattern(/^\d{4}$/).required(),
    confirmPin: Joi.string().valid(Joi.ref('pin')).required(),
    currentPassword: Joi.string().min(8).required()
});

// ===== BANK ACCOUNT SCHEMAS =====
const bankAccountSchema = Joi.object({
    accountNumber: Joi.string().pattern(/^\d{10}$/).required(),
    bankCode: Joi.string().pattern(/^\d{3}$/).required(),
    accountName: Joi.string().min(2).max(100).required()
});

const withdrawalSchema = Joi.object({
    amount: Joi.number().min(1000).max(500000).required(),
    bankAccountId: Joi.string().uuid().required(),
    transactionPin: Joi.string().length(4).pattern(/^\d{4}$/).required(),
    description: Joi.string().max(200).optional()
});

// ===== KYC SCHEMAS =====
const kycSchema = Joi.object({
    bvn: Joi.string().pattern(/^\d{11}$/).required(),
    nin: Joi.string().pattern(/^\d{11}$/).optional(),
    documentType: Joi.string().valid('passport', 'drivers_license', 'national_id').required(),
    documentNumber: Joi.string().max(50).required(),
    documentImage: Joi.string().uri().required(), // Base64 or URL
    selfieImage: Joi.string().uri().required()
});

// ===== SUPPORT SCHEMAS =====
const supportTicketSchema = Joi.object({
    subject: Joi.string().min(5).max(200).required(),
    category: Joi.string().valid('technical', 'billing', 'account', 'transaction', 'other').required(),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
    description: Joi.string().min(10).max(2000).required(),
    attachments: Joi.array().items(Joi.string().uri()).max(5).optional()
});

// ===== REFERRAL SCHEMAS =====
const referralSchema = Joi.object({
    refereeEmail: Joi.string().email().required()
});

// ===== RESELLER SCHEMAS =====
const resellerApplicationSchema = Joi.object({
    businessName: Joi.string().min(2).max(100).required(),
    businessType: Joi.string().valid('individual', 'partnership', 'company').required(),
    cacNumber: Joi.string().pattern(/^(RC)?[\d]{6,7}$/i).when('businessType', {
        is: 'company',
        then: Joi.required(),
        otherwise: Joi.optional()
    }),
    businessAddress: Joi.object({
        street: Joi.string().max(200).required(),
        city: Joi.string().max(100).required(),
        state: Joi.string().max(100).required(),
        postalCode: Joi.string().pattern(/^\d{6}$/)
    }).required(),
    estimatedMonthlyVolume: Joi.number().min(10000).required(),
    yearsOfExperience: Joi.number().min(0).max(50)
});

// ===== API KEY SCHEMAS =====
const apiKeySchema = Joi.object({
    name: Joi.string().min(3).max(50).required(),
    permissions: Joi.array().items(
        Joi.string().valid('airtime', 'data', 'electricity', 'cable', 'wallet', 'all')
    ).min(1).required(),
    expiresIn: Joi.number().min(1).max(365).default(365), // days
    ipWhitelist: Joi.array().items(Joi.string().ip()).optional()
});

// ===== WEBHOOK SCHEMAS =====
const webhookSchema = Joi.object({
    url: Joi.string().uri().required(),
    events: Joi.array().items(
        Joi.string().valid(
            'transaction.success',
            'transaction.failed',
            'wallet.funded',
            'wallet.debited',
            'kyc.approved',
            'kyc.rejected'
        )
    ).min(1).required(),
    secret: Joi.string().min(8).max(100).optional()
});

// ===== PAGINATION SCHEMAS =====
const paginationSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

// ===== FILTER SCHEMAS =====
const transactionFilterSchema = Joi.object({
    status: Joi.string().valid('pending', 'success', 'failed', 'cancelled'),
    type: Joi.string().valid('airtime', 'data', 'electricity', 'cable', 'transfer'),
    startDate: Joi.date(),
    endDate: Joi.date().min(Joi.ref('startDate')),
    minAmount: Joi.number().min(0),
    maxAmount: Joi.number().min(Joi.ref('minAmount')),
    provider: Joi.string(),
    reference: Joi.string()
});

// ===== VALIDATION FUNCTIONS =====
const validateSchema = (schema, data, options = {}) => {
    const { error, value } = schema.validate(data, {
        abortEarly: false,
        stripUnknown: true,
        ...options
    });
    
    if (error) {
        return {
            isValid: false,
            errors: error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context.value
            }))
        };
    }
    
    return {
        isValid: true,
        data: value
    };
};

// Individual validation functions
const validateUserRegistration = (data) => validateSchema(userRegistrationSchema, data);
const validateUserLogin = (data) => validateSchema(userLoginSchema, data);
const validateUserProfile = (data) => validateSchema(userProfileSchema, data);
const validateAirtimeTopup = (data) => validateSchema(airtimeTopupSchema, data);
const validateDataTopup = (data) => validateSchema(dataTopupSchema, data);
const validateElectricityBill = (data) => validateSchema(electricityBillSchema, data);
const validateCableTv = (data) => validateSchema(cableTvSchema, data);
const validateWalletFunding = (data) => validateSchema(walletFundingSchema, data);
const validateWalletTransfer = (data) => validateSchema(walletTransferSchema, data);
const validateSetTransactionPin = (data) => validateSchema(setTransactionPinSchema, data);
const validateBankAccount = (data) => validateSchema(bankAccountSchema, data);
const validateWithdrawal = (data) => validateSchema(withdrawalSchema, data);
const validateKyc = (data) => validateSchema(kycSchema, data);
const validateSupportTicket = (data) => validateSchema(supportTicketSchema, data);
const validateReferral = (data) => validateSchema(referralSchema, data);
const validateResellerApplication = (data) => validateSchema(resellerApplicationSchema, data);
const validateApiKey = (data) => validateSchema(apiKeySchema, data);
const validateWebhook = (data) => validateSchema(webhookSchema, data);
const validatePagination = (data) => validateSchema(paginationSchema, data);
const validateTransactionFilter = (data) => validateSchema(transactionFilterSchema, data);

// Express middleware factory
const createValidationMiddleware = (schema) => {
    return (req, res, next) => {
        const validation = validateSchema(schema, req.body);
        
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validation.errors
            });
        }
        
        // Replace req.body with validated and sanitized data
        req.body = validation.data;
        next();
    };
};

module.exports = {
    // Schemas
    schemas: {
        userRegistrationSchema,
        userLoginSchema,
        userProfileSchema,
        airtimeTopupSchema,
        dataTopupSchema,
        electricityBillSchema,
        cableTvSchema,
        walletFundingSchema,
        walletTransferSchema,
        setTransactionPinSchema,
        bankAccountSchema,
        withdrawalSchema,
        kycSchema,
        supportTicketSchema,
        referralSchema,
        resellerApplicationSchema,
        apiKeySchema,
        webhookSchema,
        paginationSchema,
        transactionFilterSchema
    },
    
    // Validation functions
    validateUserRegistration,
    validateUserLogin,
    validateUserProfile,
    validateAirtimeTopup,
    validateDataTopup,
    validateElectricityBill,
    validateCableTv,
    validateWalletFunding,
    validateWalletTransfer,
    validateSetTransactionPin,
    validateBankAccount,
    validateWithdrawal,
    validateKyc,
    validateSupportTicket,
    validateReferral,
    validateResellerApplication,
    validateApiKey,
    validateWebhook,
    validatePagination,
    validateTransactionFilter,
    
    // Utilities
    validateSchema,
    createValidationMiddleware
};
