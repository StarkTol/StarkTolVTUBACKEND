const crypto = require('crypto');

// Generate standardized API response
const generateResponse = (success, message, data = null, meta = null) => {
    const response = {
        success,
        message,
        timestamp: new Date().toISOString()
    };

    if (data !== null) {
        response.data = data;
    }

    if (meta !== null) {
        response.meta = meta;
    }

    return response;
};

// Generate random string
const generateRandomString = (length = 16, includeNumbers = true, includeSymbols = false) => {
    let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    
    if (includeNumbers) {
        chars += '0123456789';
    }
    
    if (includeSymbols) {
        chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    }
    
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
};

// Generate secure hash
const generateHash = (data, algorithm = 'sha256') => {
    return crypto.createHash(algorithm).update(data).digest('hex');
};

// Generate HMAC signature
const generateHMAC = (data, secret, algorithm = 'sha256') => {
    return crypto.createHmac(algorithm, secret).update(data).digest('hex');
};

// Verify HMAC signature
const verifyHMAC = (data, signature, secret, algorithm = 'sha256') => {
    const expectedSignature = generateHMAC(data, secret, algorithm);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
};

// Format currency
const formatCurrency = (amount, currency = 'NGN', locale = 'en-NG') => {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(amount);
};

// Format date
const formatDate = (date, options = {}) => {
    const defaultOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Lagos'
    };
    
    const formatOptions = { ...defaultOptions, ...options };
    return new Intl.DateTimeFormat('en-NG', formatOptions).format(new Date(date));
};

// Calculate time difference
const getTimeDifference = (startDate, endDate = new Date()) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end - start;
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return {
        days: diffDays,
        hours: diffHours,
        minutes: diffMinutes,
        totalMs: diffMs
    };
};

// Sanitize string for URL
const slugify = (text) => {
    return text
        .toLowerCase()
        .replace(/[^\w ]+/g, '')
        .replace(/ +/g, '-')
        .trim();
};

// Truncate text
const truncateText = (text, maxLength = 100, suffix = '...') => {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength - suffix.length) + suffix;
};

// Deep clone object
const deepClone = (obj) => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    
    if (obj instanceof Array) {
        return obj.map(item => deepClone(item));
    }
    
    if (typeof obj === 'object') {
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
};

// Remove sensitive data from object
const sanitizeObject = (obj, sensitiveFields = ['password', 'secret', 'token', 'key']) => {
    const sanitized = deepClone(obj);
    
    const removeSensitiveFields = (object) => {
        for (const key in object) {
            if (object.hasOwnProperty(key)) {
                if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                    delete object[key];
                } else if (typeof object[key] === 'object' && object[key] !== null) {
                    removeSensitiveFields(object[key]);
                }
            }
        }
    };
    
    removeSensitiveFields(sanitized);
    return sanitized;
};

// Parse phone number to international format
const parsePhoneNumber = (phoneNumber, countryCode = '234') => {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Handle different formats
    if (cleaned.startsWith('0')) {
        cleaned = countryCode + cleaned.substring(1);
    } else if (cleaned.startsWith(countryCode)) {
        // Already in correct format
    } else if (cleaned.length === 10) {
        cleaned = countryCode + cleaned;
    }
    
    return `+${cleaned}`;
};

// Generate reference number
const generateReference = (prefix = 'STK', length = 12) => {
    const timestamp = Date.now().toString();
    const random = generateRandomString(length - timestamp.length, true, false);
    return `${prefix}_${timestamp}${random}`.toUpperCase();
};

// Mask sensitive data
const maskData = (data, visibleChars = 4, maskChar = '*') => {
    if (!data || typeof data !== 'string') {
        return data;
    }
    
    if (data.length <= visibleChars * 2) {
        return maskChar.repeat(data.length);
    }
    
    const start = data.substring(0, visibleChars);
    const end = data.substring(data.length - visibleChars);
    const middle = maskChar.repeat(data.length - (visibleChars * 2));
    
    return start + middle + end;
};

// Validate environment variables
const validateEnvVars = (requiredVars) => {
    const missingVars = [];
    
    requiredVars.forEach(varName => {
        if (!process.env[varName]) {
            missingVars.push(varName);
        }
    });
    
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    
    return true;
};

// Rate limiting helper
const createRateLimiter = (windowMs = 60000, maxRequests = 100) => {
    const requests = new Map();
    
    return (identifier) => {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        // Clean old requests
        for (const [key, timestamps] of requests.entries()) {
            const validTimestamps = timestamps.filter(ts => ts > windowStart);
            if (validTimestamps.length === 0) {
                requests.delete(key);
            } else {
                requests.set(key, validTimestamps);
            }
        }
        
        // Check current identifier
        const userRequests = requests.get(identifier) || [];
        const validUserRequests = userRequests.filter(ts => ts > windowStart);
        
        if (validUserRequests.length >= maxRequests) {
            return {
                allowed: false,
                resetTime: Math.min(...validUserRequests) + windowMs
            };
        }
        
        validUserRequests.push(now);
        requests.set(identifier, validUserRequests);
        
        return {
            allowed: true,
            remaining: maxRequests - validUserRequests.length
        };
    };
};

// Retry operation with exponential backoff
const retryOperation = async (operation, maxRetries = 3, initialDelay = 1000) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            if (attempt === maxRetries) {
                break;
            }
            
            const delay = initialDelay * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
};

// Calculate percentage
const calculatePercentage = (value, total, decimals = 2) => {
    if (total === 0) return 0;
    return Number(((value / total) * 100).toFixed(decimals));
};

// Calculate discount amount
const calculateDiscount = (originalAmount, discountPercentage) => {
    const discount = (originalAmount * discountPercentage) / 100;
    return {
        original: originalAmount,
        discount: discount,
        final: originalAmount - discount,
        percentage: discountPercentage
    };
};

// Validate JSON string
const isValidJSON = (str) => {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
};

module.exports = {
    generateResponse,
    generateRandomString,
    generateHash,
    generateHMAC,
    verifyHMAC,
    formatCurrency,
    formatDate,
    getTimeDifference,
    slugify,
    truncateText,
    deepClone,
    sanitizeObject,
    parsePhoneNumber,
    generateReference,
    maskData,
    validateEnvVars,
    createRateLimiter,
    retryOperation,
    calculatePercentage,
    calculateDiscount,
    isValidJSON
};
