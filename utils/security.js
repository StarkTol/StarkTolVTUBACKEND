/**
 * Security Utilities for VTU Platform
 * Provides encryption, hashing, signature verification, and security helpers
 */
const crypto = require('crypto');

// Configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;

// Get encryption key from environment or generate
const MASTER_KEY = process.env.ENCRYPTION_KEY ? 
    Buffer.from(process.env.ENCRYPTION_KEY, 'hex') : 
    crypto.randomBytes(KEY_LENGTH);

// ===== HASHING FUNCTIONS =====

/**
 * Hash data using SHA-256
 * @param {string} data - Data to hash
 * @param {string} salt - Optional salt
 * @returns {string} Hex encoded hash
 */
const hashData = (data, salt = '') => {
    return crypto.createHash('sha256').update(data + salt).digest('hex');
};

/**
 * Hash data using SHA-512 with salt
 * @param {string} data - Data to hash
 * @param {string} salt - Salt for hashing
 * @returns {string} Hex encoded hash
 */
const hashWithSalt = (data, salt) => {
    return crypto.createHash('sha512').update(data + salt).digest('hex');
};

/**
 * Generate cryptographically secure salt
 * @param {number} length - Salt length in bytes
 * @returns {string} Hex encoded salt
 */
const generateSalt = (length = SALT_LENGTH) => {
    return crypto.randomBytes(length).toString('hex');
};

/**
 * Hash password with bcrypt-like functionality using PBKDF2
 * @param {string} password - Password to hash
 * @param {number} iterations - Number of iterations
 * @returns {string} Salt + hash combined
 */
const hashPassword = (password, iterations = 100000) => {
    const salt = generateSalt();
    const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
    return `${salt}:${hash}:${iterations}`;
};

/**
 * Verify password against hash
 * @param {string} password - Password to verify
 * @param {string} storedHash - Stored hash to verify against
 * @returns {boolean} True if password matches
 */
const verifyPassword = (password, storedHash) => {
    try {
        const [salt, hash, iterations] = storedHash.split(':');
        const computedHash = crypto.pbkdf2Sync(password, salt, parseInt(iterations), 64, 'sha512').toString('hex');
        return hash === computedHash;
    } catch (error) {
        return false;
    }
};

// ===== ENCRYPTION/DECRYPTION =====

/**
 * Encrypt data using AES-256-GCM
 * @param {string} plaintext - Data to encrypt
 * @param {string} secretKey - Optional secret key (hex encoded)
 * @returns {string} Encrypted data (iv:tag:ciphertext)
 */
const encryptData = (plaintext, secretKey = null) => {
    try {
        const key = secretKey ? Buffer.from(secretKey, 'hex') : MASTER_KEY;
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const tag = cipher.getAuthTag();
        
        return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
    } catch (error) {
        throw new Error(`Encryption failed: ${error.message}`);
    }
};

/**
 * Decrypt data using AES-256-GCM
 * @param {string} encryptedData - Encrypted data (iv:tag:ciphertext)
 * @param {string} secretKey - Optional secret key (hex encoded)
 * @returns {string} Decrypted plaintext
 */
const decryptData = (encryptedData, secretKey = null) => {
    try {
        const key = secretKey ? Buffer.from(secretKey, 'hex') : MASTER_KEY;
        const [ivHex, tagHex, encrypted] = encryptedData.split(':');
        
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        throw new Error(`Decryption failed: ${error.message}`);
    }
};

// ===== DIGITAL SIGNATURES =====

/**
 * Create HMAC signature for data
 * @param {string} data - Data to sign
 * @param {string} secret - Secret key for signing
 * @returns {string} HMAC signature
 */
const createSignature = (data, secret) => {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
};

/**
 * Verify HMAC signature
 * @param {string} data - Original data
 * @param {string} signature - Signature to verify
 * @param {string} secret - Secret key for verification
 * @returns {boolean} True if signature is valid
 */
const verifySignature = (data, signature, secret) => {
    const computedSignature = createSignature(data, secret);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature));
};

/**
 * Create timestamped signature (includes timestamp in signature)
 * @param {string} data - Data to sign
 * @param {string} secret - Secret key
 * @param {number} timestamp - Optional timestamp (defaults to now)
 * @returns {object} {signature, timestamp}
 */
const createTimestampedSignature = (data, secret, timestamp = Date.now()) => {
    const dataWithTimestamp = `${data}:${timestamp}`;
    const signature = createSignature(dataWithTimestamp, secret);
    return { signature, timestamp };
};

/**
 * Verify timestamped signature with expiry check
 * @param {string} data - Original data
 * @param {string} signature - Signature to verify
 * @param {number} timestamp - Timestamp from signature
 * @param {string} secret - Secret key
 * @param {number} maxAge - Maximum age in milliseconds (default: 5 minutes)
 * @returns {boolean} True if signature is valid and not expired
 */
const verifyTimestampedSignature = (data, signature, timestamp, secret, maxAge = 5 * 60 * 1000) => {
    // Check if signature is expired
    if (Date.now() - timestamp > maxAge) {
        return false;
    }
    
    const dataWithTimestamp = `${data}:${timestamp}`;
    return verifySignature(dataWithTimestamp, signature, secret);
};

// ===== FLUTTERWAVE SPECIFIC SECURITY =====

/**
 * Encrypt data for Flutterwave (3DES)
 * @param {string} plaintext - Data to encrypt
 * @param {string} encryptionKey - Flutterwave encryption key
 * @returns {string} Base64 encoded encrypted data
 */
const encryptForFlutterwave = (plaintext, encryptionKey) => {
    try {
        const key = Buffer.from(encryptionKey, 'utf8');
        const cipher = crypto.createCipher('des-ede3', key);
        
        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        return encrypted;
    } catch (error) {
        throw new Error(`Flutterwave encryption failed: ${error.message}`);
    }
};

/**
 * Create Flutterwave integrity hash
 * @param {object} payload - Payment payload
 * @param {string} secretHash - Flutterwave secret hash
 * @returns {string} Integrity hash
 */
const createFlutterwaveIntegrityHash = (payload, secretHash) => {
    const sortedKeys = Object.keys(payload).sort();
    const stringToHash = sortedKeys.map(key => payload[key]).join('');
    return crypto.createHmac('sha256', secretHash).update(stringToHash).digest('hex');
};

// ===== TOKEN GENERATION =====

/**
 * Generate secure random token
 * @param {number} length - Token length in bytes
 * @returns {string} Hex encoded token
 */
const generateSecureToken = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate URL-safe random token
 * @param {number} length - Token length in bytes
 * @returns {string} URL-safe base64 encoded token
 */
const generateUrlSafeToken = (length = 32) => {
    return crypto.randomBytes(length).toString('base64url');
};

/**
 * Generate numeric PIN
 * @param {number} length - PIN length
 * @returns {string} Numeric PIN
 */
const generateNumericPin = (length = 4) => {
    let pin = '';
    for (let i = 0; i < length; i++) {
        pin += Math.floor(Math.random() * 10);
    }
    return pin;
};

// ===== API KEY MANAGEMENT =====

/**
 * Generate API key with prefix
 * @param {string} prefix - API key prefix (e.g., 'sk_', 'pk_')
 * @param {number} length - Key length in bytes
 * @returns {string} Generated API key
 */
const generateApiKey = (prefix = 'sk_', length = 32) => {
    const randomBytes = crypto.randomBytes(length).toString('hex');
    return `${prefix}${randomBytes}`;
};

/**
 * Hash API key for storage
 * @param {string} apiKey - API key to hash
 * @returns {string} Hashed API key
 */
const hashApiKey = (apiKey) => {
    return hashData(apiKey, 'api_key_salt');
};

// ===== WEBHOOK SECURITY =====

/**
 * Verify webhook signature from headers
 * @param {string} payload - Webhook payload
 * @param {string} signature - Signature from header
 * @param {string} secret - Webhook secret
 * @param {string} algorithm - Hash algorithm (default: sha256)
 * @returns {boolean} True if signature is valid
 */
const verifyWebhookSignature = (payload, signature, secret, algorithm = 'sha256') => {
    try {
        const computedSignature = crypto
            .createHmac(algorithm, secret)
            .update(payload, 'utf8')
            .digest('hex');
        
        // Handle different signature formats
        const cleanSignature = signature.replace(/^(sha256=|sha1=)/, '');
        
        return crypto.timingSafeEqual(
            Buffer.from(cleanSignature, 'hex'),
            Buffer.from(computedSignature, 'hex')
        );
    } catch (error) {
        return false;
    }
};

// ===== INPUT SANITIZATION =====

/**
 * Sanitize input to prevent injection attacks
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    
    return input
        .replace(/[<>"'&]/g, '') // Remove potential XSS characters
        .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control characters
        .trim();
};

/**
 * Mask sensitive data for logging
 * @param {string} data - Data to mask
 * @param {number} visibleChars - Number of characters to leave visible
 * @returns {string} Masked data
 */
const maskSensitiveData = (data, visibleChars = 4) => {
    if (!data || data.length <= visibleChars) {
        return '*'.repeat(data?.length || 0);
    }
    
    const visible = data.slice(0, visibleChars);
    const masked = '*'.repeat(data.length - visibleChars);
    return visible + masked;
};

// ===== TRANSACTION REFERENCE GENERATION =====

/**
 * Generate unique transaction reference
 * @param {string} prefix - Reference prefix
 * @returns {string} Unique transaction reference
 */
const generateTransactionRef = (prefix = 'TXN') => {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}_${timestamp}_${randomBytes}`;
};

/**
 * Generate deterministic reference (for idempotency)
 * @param {string} userId - User ID
 * @param {string} action - Action type
 * @param {object} params - Action parameters
 * @returns {string} Deterministic reference
 */
const generateDeterministicRef = (userId, action, params) => {
    const data = JSON.stringify({ userId, action, params });
    const hash = hashData(data).substring(0, 16).toUpperCase();
    return `${action.toUpperCase()}_${hash}`;
};

module.exports = {
    // Hashing
    hashData,
    hashWithSalt,
    generateSalt,
    hashPassword,
    verifyPassword,
    
    // Encryption/Decryption
    encryptData,
    decryptData,
    
    // Digital Signatures
    createSignature,
    verifySignature,
    createTimestampedSignature,
    verifyTimestampedSignature,
    
    // Flutterwave Specific
    encryptForFlutterwave,
    createFlutterwaveIntegrityHash,
    
    // Token Generation
    generateSecureToken,
    generateUrlSafeToken,
    generateNumericPin,
    
    // API Key Management
    generateApiKey,
    hashApiKey,
    
    // Webhook Security
    verifyWebhookSignature,
    
    // Input Security
    sanitizeInput,
    maskSensitiveData,
    
    // Transaction References
    generateTransactionRef,
    generateDeterministicRef
};

