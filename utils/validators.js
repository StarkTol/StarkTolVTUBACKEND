// Email validation
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Password validation
const validatePassword = (password) => {
    // At least 8 characters, containing letters and numbers
    return password && password.length >= 8;
};

// Strong password validation
const validateStrongPassword = (password) => {
    // At least 8 characters, uppercase, lowercase, number, and special character
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongPasswordRegex.test(password);
};

// Phone number validation (Nigerian format)
const validatePhoneNumber = (phone) => {
    // Supports formats: +234XXXXXXXXXX, 234XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXXX
    const phoneRegex = /^(\+234|234|0)?[789]\d{9}$/;
    return phoneRegex.test(phone);
};

// International phone number validation
const validateInternationalPhone = (phone) => {
    const intlPhoneRegex = /^\+[1-9]\d{1,14}$/;
    return intlPhoneRegex.test(phone);
};

// Name validation
const validateName = (name) => {
    // At least 2 characters, only letters, spaces, hyphens, and apostrophes
    const nameRegex = /^[a-zA-Z\s\-']{2,50}$/;
    return nameRegex.test(name);
};

// Amount validation
const validateAmount = (amount, min = 0, max = Infinity) => {
    const numAmount = parseFloat(amount);
    return !isNaN(numAmount) && numAmount >= min && numAmount <= max;
};

// Bank account number validation (Nigerian)
const validateBankAccount = (accountNumber) => {
    // Nigerian bank account numbers are typically 10 digits
    const accountRegex = /^\d{10}$/;
    return accountRegex.test(accountNumber);
};

// BVN validation (Bank Verification Number)
const validateBVN = (bvn) => {
    // BVN is 11 digits
    const bvnRegex = /^\d{11}$/;
    return bvnRegex.test(bvn);
};

// NIN validation (National Identification Number)
const validateNIN = (nin) => {
    // NIN is 11 digits
    const ninRegex = /^\d{11}$/;
    return ninRegex.test(nin);
};

// Credit card validation (Luhn algorithm)
const validateCreditCard = (cardNumber) => {
    // Remove spaces and hyphens
    const cleaned = cardNumber.replace(/[\s-]/g, '');
    
    // Check if it's all digits and has valid length
    if (!/^\d{13,19}$/.test(cleaned)) {
        return false;
    }
    
    // Luhn algorithm
    let sum = 0;
    let isEven = false;
    
    for (let i = cleaned.length - 1; i >= 0; i--) {
        let digit = parseInt(cleaned[i]);
        
        if (isEven) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }
        
        sum += digit;
        isEven = !isEven;
    }
    
    return sum % 10 === 0;
};

// CVV validation
const validateCVV = (cvv, cardType = 'visa') => {
    // Most cards use 3 digits, Amex uses 4
    const length = cardType.toLowerCase() === 'amex' ? 4 : 3;
    const cvvRegex = new RegExp(`^\\d{${length}}$`);
    return cvvRegex.test(cvv);
};

// URL validation
const validateURL = (url) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

// Domain validation
const validateDomain = (domain) => {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
};

// IP address validation
const validateIPAddress = (ip) => {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
};

// MAC address validation
const validateMACAddress = (mac) => {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return macRegex.test(mac);
};

// Date validation
const validateDate = (date, format = 'YYYY-MM-DD') => {
    const dateObj = new Date(date);
    return dateObj instanceof Date && !isNaN(dateObj);
};

// Age validation
const validateAge = (birthDate, minAge = 18, maxAge = 120) => {
    const birth = new Date(birthDate);
    const today = new Date();
    const age = Math.floor((today - birth) / (365.25 * 24 * 60 * 60 * 1000));
    return age >= minAge && age <= maxAge;
};

// File extension validation
const validateFileExtension = (filename, allowedExtensions = []) => {
    const extension = filename.toLowerCase().split('.').pop();
    return allowedExtensions.includes(extension);
};

// File size validation
const validateFileSize = (fileSize, maxSizeInMB = 5) => {
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    return fileSize <= maxSizeInBytes;
};

// Hex color validation
const validateHexColor = (color) => {
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexRegex.test(color);
};

// UUID validation
const validateUUID = (uuid) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
};

// Base64 validation
const validateBase64 = (str) => {
    try {
        return btoa(atob(str)) === str;
    } catch (err) {
        return false;
    }
};

// JSON validation
const validateJSON = (str) => {
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
};

// Coordinate validation (latitude/longitude)
const validateCoordinates = (lat, lng) => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    return !isNaN(latitude) && !isNaN(longitude) &&
           latitude >= -90 && latitude <= 90 &&
           longitude >= -180 && longitude <= 180;
};

// Nigerian state validation
const validateNigerianState = (state) => {
    const nigerianStates = [
        'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 
        'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 
        'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 
        'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 
        'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara', 'FCT'
    ];
    
    return nigerianStates.includes(state);
};

// Meter number validation (electricity)
const validateMeterNumber = (meterNumber, meterType = 'prepaid') => {
    // Nigerian meter numbers are typically 11-13 digits
    const meterRegex = /^\d{11,13}$/;
    return meterRegex.test(meterNumber);
};

// Smartcard number validation (cable TV)
const validateSmartcardNumber = (smartcardNumber) => {
    // Smartcard numbers vary but are typically 10-12 digits
    const smartcardRegex = /^\d{10,12}$/;
    return smartcardRegex.test(smartcardNumber);
};

// Reference code validation
const validateReferenceCode = (code) => {
    // Reference codes should be alphanumeric, 6-20 characters
    const refRegex = /^[A-Za-z0-9]{6,20}$/;
    return refRegex.test(code);
};

// Business registration number validation (Nigerian CAC)
const validateCACNumber = (cacNumber) => {
    // CAC numbers are typically 6-7 digits optionally prefixed with RC
    const cacRegex = /^(RC)?[\d]{6,7}$/i;
    return cacRegex.test(cacNumber);
};

// Tax identification number validation (Nigerian TIN)
const validateTIN = (tin) => {
    // TIN is typically 8-10 digits
    const tinRegex = /^\d{8,10}$/;
    return tinRegex.test(tin);
};

// Postal code validation (Nigerian)
const validatePostalCode = (postalCode) => {
    // Nigerian postal codes are 6 digits
    const postalRegex = /^\d{6}$/;
    return postalRegex.test(postalCode);
};

// Validation middleware factory
const createValidator = (validationRules) => {
    return (data) => {
        const errors = [];
        
        for (const [field, rules] of Object.entries(validationRules)) {
            const value = data[field];
            
            for (const rule of rules) {
                if (typeof rule === 'function') {
                    if (!rule(value)) {
                        errors.push(`Invalid ${field}`);
                    }
                } else if (typeof rule === 'object') {
                    const { validator, message } = rule;
                    if (!validator(value)) {
                        errors.push(message || `Invalid ${field}`);
                    }
                }
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    };
};

// Sanitization functions
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    
    return input
        .trim()
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, ''); // Remove event handlers
};

const sanitizeEmail = (email) => {
    return email.toLowerCase().trim();
};

const sanitizePhoneNumber = (phone) => {
    return phone.replace(/\D/g, ''); // Remove all non-digit characters
};

module.exports = {
    validateEmail,
    validatePassword,
    validateStrongPassword,
    validatePhoneNumber,
    validateInternationalPhone,
    validateName,
    validateAmount,
    validateBankAccount,
    validateBVN,
    validateNIN,
    validateCreditCard,
    validateCVV,
    validateURL,
    validateDomain,
    validateIPAddress,
    validateMACAddress,
    validateDate,
    validateAge,
    validateFileExtension,
    validateFileSize,
    validateHexColor,
    validateUUID,
    validateBase64,
    validateJSON,
    validateCoordinates,
    validateNigerianState,
    validateMeterNumber,
    validateSmartcardNumber,
    validateReferenceCode,
    validateCACNumber,
    validateTIN,
    validatePostalCode,
    createValidator,
    sanitizeInput,
    sanitizeEmail,
    sanitizePhoneNumber
};
