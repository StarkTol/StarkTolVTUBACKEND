/**
 * Input Sanitization and Validation Utilities
 * Provides comprehensive input sanitization, XSS protection, and validation
 */
const xss = require('xss');
const validator = require('validator');
const DOMPurify = require('isomorphic-dompurify');

/**
 * Input Sanitizer Class
 * Handles all input sanitization and validation
 */
class InputSanitizer {
    constructor() {
        // XSS protection options - very restrictive
        this.xssOptions = {
            whiteList: {}, // No HTML tags allowed by default
            stripIgnoreTag: true,
            stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed'],
            allowCommentTag: false,
            escapeHtml: function(html) {
                return html
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;')
                    .replace(/\//g, '&#x2F;');
            }
        };
    }

    /**
     * Sanitize string input - removes HTML, scripts, and malicious content
     * @param {string} input - Input string to sanitize
     * @param {object} options - Sanitization options
     * @returns {string} Sanitized string
     */
    sanitizeString(input, options = {}) {
        if (typeof input !== 'string') {
            return '';
        }

        // Remove null bytes and control characters
        let sanitized = input.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        
        // Apply XSS filtering
        sanitized = xss(sanitized, { ...this.xssOptions, ...options });
        
        // Additional cleaning using DOMPurify as backup
        sanitized = DOMPurify.sanitize(sanitized, { 
            ALLOWED_TAGS: [], 
            ALLOWED_ATTR: [] 
        });
        
        // Trim whitespace
        sanitized = sanitized.trim();
        
        return sanitized;
    }

    /**
     * Sanitize email input
     * @param {string} email - Email to sanitize
     * @returns {string} Sanitized email or empty string if invalid
     */
    sanitizeEmail(email) {
        if (typeof email !== 'string') return '';
        
        const sanitized = this.sanitizeString(email).toLowerCase();
        return validator.isEmail(sanitized) ? sanitized : '';
    }

    /**
     * Sanitize phone number input
     * @param {string} phone - Phone number to sanitize
     * @returns {string} Sanitized phone number
     */
    sanitizePhone(phone) {
        if (typeof phone !== 'string') return '';
        
        // Remove all non-digit characters except +
        const sanitized = phone.replace(/[^+\d]/g, '');
        
        // Basic Nigerian phone number validation
        if (/^(\+234|234|0)?[789]\d{9}$/.test(sanitized)) {
            return sanitized;
        }
        
        return '';
    }

    /**
     * Sanitize numeric input
     * @param {any} input - Input to sanitize as number
     * @param {object} options - Validation options (min, max, decimals)
     * @returns {number|null} Sanitized number or null if invalid
     */
    sanitizeNumber(input, options = {}) {
        const { min = null, max = null, decimals = null } = options;
        
        if (typeof input === 'number' && !isNaN(input)) {
            let num = input;
            
            // Apply decimal places limit
            if (decimals !== null) {
                num = parseFloat(num.toFixed(decimals));
            }
            
            // Apply range validation
            if (min !== null && num < min) return null;
            if (max !== null && num > max) return null;
            
            return num;
        }
        
        if (typeof input === 'string') {
            const sanitized = this.sanitizeString(input);
            const num = parseFloat(sanitized);
            
            if (isNaN(num)) return null;
            
            return this.sanitizeNumber(num, options);
        }
        
        return null;
    }

    /**
     * Sanitize boolean input
     * @param {any} input - Input to sanitize as boolean
     * @returns {boolean} Sanitized boolean
     */
    sanitizeBoolean(input) {
        if (typeof input === 'boolean') return input;
        if (typeof input === 'string') {
            const sanitized = this.sanitizeString(input).toLowerCase();
            return ['true', '1', 'yes', 'on'].includes(sanitized);
        }
        if (typeof input === 'number') return input !== 0;
        return false;
    }

    /**
     * Sanitize object recursively
     * @param {object} obj - Object to sanitize
     * @param {object} schema - Sanitization schema
     * @returns {object} Sanitized object
     */
    sanitizeObject(obj, schema = {}) {
        if (typeof obj !== 'object' || obj === null) {
            return {};
        }

        const sanitized = {};
        
        for (const [key, value] of Object.entries(obj)) {
            const sanitizedKey = this.sanitizeString(key);
            const schemaRule = schema[key] || schema[sanitizedKey];
            
            if (schemaRule) {
                switch (schemaRule.type) {
                    case 'string':
                        sanitized[sanitizedKey] = this.sanitizeString(value, schemaRule.options);
                        break;
                    case 'email':
                        sanitized[sanitizedKey] = this.sanitizeEmail(value);
                        break;
                    case 'phone':
                        sanitized[sanitizedKey] = this.sanitizePhone(value);
                        break;
                    case 'number':
                        sanitized[sanitizedKey] = this.sanitizeNumber(value, schemaRule.options);
                        break;
                    case 'boolean':
                        sanitized[sanitizedKey] = this.sanitizeBoolean(value);
                        break;
                    case 'array':
                        sanitized[sanitizedKey] = this.sanitizeArray(value, schemaRule.itemSchema);
                        break;
                    case 'object':
                        sanitized[sanitizedKey] = this.sanitizeObject(value, schemaRule.schema);
                        break;
                    default:
                        sanitized[sanitizedKey] = this.sanitizeString(value);
                }
            } else {
                // Default to string sanitization if no schema provided
                if (typeof value === 'object' && value !== null) {
                    sanitized[sanitizedKey] = this.sanitizeObject(value);
                } else {
                    sanitized[sanitizedKey] = this.sanitizeString(value);
                }
            }
        }
        
        return sanitized;
    }

    /**
     * Sanitize array input
     * @param {array} arr - Array to sanitize
     * @param {object} itemSchema - Schema for array items
     * @returns {array} Sanitized array
     */
    sanitizeArray(arr, itemSchema = { type: 'string' }) {
        if (!Array.isArray(arr)) return [];
        
        return arr.map(item => {
            switch (itemSchema.type) {
                case 'string':
                    return this.sanitizeString(item, itemSchema.options);
                case 'email':
                    return this.sanitizeEmail(item);
                case 'phone':
                    return this.sanitizePhone(item);
                case 'number':
                    return this.sanitizeNumber(item, itemSchema.options);
                case 'boolean':
                    return this.sanitizeBoolean(item);
                case 'object':
                    return this.sanitizeObject(item, itemSchema.schema);
                default:
                    return this.sanitizeString(item);
            }
        }).filter(item => item !== null && item !== '');
    }

    /**
     * Remove SQL injection patterns
     * @param {string} input - Input string
     * @returns {string} Cleaned string
     */
    removeSQLInjection(input) {
        if (typeof input !== 'string') return '';
        
        // Common SQL injection patterns
        const sqlPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/gi,
            /(--|\||\*|;|'|"|`)/g,
            /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
            /(\b(OR|AND)\s+['"]\w*['"]\s*=\s*['"])/gi
        ];
        
        let sanitized = input;
        sqlPatterns.forEach(pattern => {
            sanitized = sanitized.replace(pattern, '');
        });
        
        return sanitized.trim();
    }

    /**
     * Remove NoSQL injection patterns
     * @param {string} input - Input string
     * @returns {string} Cleaned string
     */
    removeNoSQLInjection(input) {
        if (typeof input !== 'string') return '';
        
        // Remove MongoDB operators and other NoSQL injection patterns
        const noSQLPatterns = [
            /\$where/gi,
            /\$ne/gi,
            /\$in/gi,
            /\$nin/gi,
            /\$gt/gi,
            /\$gte/gi,
            /\$lt/gi,
            /\$lte/gi,
            /\$regex/gi,
            /\$exists/gi,
            /\$type/gi,
            /\$mod/gi,
            /\$all/gi,
            /\$size/gi,
            /\$or/gi,
            /\$and/gi,
            /\$not/gi,
            /\$nor/gi
        ];
        
        let sanitized = input;
        noSQLPatterns.forEach(pattern => {
            sanitized = sanitized.replace(pattern, '');
        });
        
        return sanitized.trim();
    }

    /**
     * Comprehensive input sanitization
     * @param {any} input - Input to sanitize
     * @param {object} options - Sanitization options
     * @returns {any} Sanitized input
     */
    sanitizeInput(input, options = {}) {
        const { type = 'string', schema = null, ...otherOptions } = options;
        
        switch (type) {
            case 'string':
                let sanitized = this.sanitizeString(input, otherOptions);
                sanitized = this.removeSQLInjection(sanitized);
                sanitized = this.removeNoSQLInjection(sanitized);
                return sanitized;
            case 'email':
                return this.sanitizeEmail(input);
            case 'phone':
                return this.sanitizePhone(input);
            case 'number':
                return this.sanitizeNumber(input, otherOptions);
            case 'boolean':
                return this.sanitizeBoolean(input);
            case 'array':
                return this.sanitizeArray(input, otherOptions.itemSchema);
            case 'object':
                return this.sanitizeObject(input, schema);
            default:
                return this.sanitizeString(input, otherOptions);
        }
    }

    /**
     * Create Express middleware for input sanitization
     * @param {object} schema - Sanitization schema for request body
     * @returns {function} Express middleware
     */
    createSanitizationMiddleware(schema = {}) {
        return (req, res, next) => {
            try {
                // Sanitize request body
                if (req.body && typeof req.body === 'object') {
                    req.body = this.sanitizeObject(req.body, schema);
                }
                
                // Sanitize query parameters
                if (req.query && typeof req.query === 'object') {
                    req.query = this.sanitizeObject(req.query, schema.query || {});
                }
                
                // Sanitize URL parameters
                if (req.params && typeof req.params === 'object') {
                    req.params = this.sanitizeObject(req.params, schema.params || {});
                }
                
                next();
            } catch (error) {
                console.error('Input sanitization error:', error);
                res.status(400).json({
                    success: false,
                    message: 'Invalid input data',
                    error: 'Input sanitization failed'
                });
            }
        };
    }
}

// Create singleton instance
const inputSanitizer = new InputSanitizer();

module.exports = {
    InputSanitizer,
    inputSanitizer,
    
    // Direct access to common sanitization methods
    sanitizeString: (input, options) => inputSanitizer.sanitizeString(input, options),
    sanitizeEmail: (input) => inputSanitizer.sanitizeEmail(input),
    sanitizePhone: (input) => inputSanitizer.sanitizePhone(input),
    sanitizeNumber: (input, options) => inputSanitizer.sanitizeNumber(input, options),
    sanitizeBoolean: (input) => inputSanitizer.sanitizeBoolean(input),
    sanitizeObject: (obj, schema) => inputSanitizer.sanitizeObject(obj, schema),
    sanitizeArray: (arr, itemSchema) => inputSanitizer.sanitizeArray(arr, itemSchema),
    sanitizeInput: (input, options) => inputSanitizer.sanitizeInput(input, options),
    createSanitizationMiddleware: (schema) => inputSanitizer.createSanitizationMiddleware(schema)
};
