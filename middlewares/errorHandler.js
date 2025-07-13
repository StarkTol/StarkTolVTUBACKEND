const { generateResponse } = require('../utils/helpers');

const errorHandler = (err, req, res, next) => {
    console.error('Error occurred:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        user: req.user ? req.user.id : 'anonymous',
        timestamp: new Date().toISOString()
    });

    // Handle specific error types
    if (err.name === 'ValidationError') {
        return res.status(400).json(generateResponse(false, 'Validation error', {
            errors: err.errors
        }));
    }

    if (err.name === 'CastError') {
        return res.status(400).json(generateResponse(false, 'Invalid data format'));
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json(generateResponse(false, 'File size too large'));
    }

    // Handle Supabase specific errors
    if (err.code === 'PGRST116') {
        return res.status(404).json(generateResponse(false, 'Resource not found'));
    }

    if (err.code === '23505') { // Unique constraint violation
        return res.status(409).json(generateResponse(false, 'Duplicate entry found'));
    }

    if (err.code === '23503') { // Foreign key constraint violation
        return res.status(400).json(generateResponse(false, 'Referenced resource not found'));
    }

    if (err.code === '42P01') { // Undefined table
        return res.status(500).json(generateResponse(false, 'Database configuration error'));
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json(generateResponse(false, 'Invalid token'));
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json(generateResponse(false, 'Token expired'));
    }

    // Handle rate limiting errors
    if (err.status === 429) {
        return res.status(429).json(generateResponse(false, 'Too many requests. Please try again later.'));
    }

    // Handle syntax errors
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json(generateResponse(false, 'Invalid JSON format'));
    }

    // Default error response
    const isDevelopment = process.env.NODE_ENV === 'development';
    const message = isDevelopment ? err.message : 'Internal server error';
    const statusCode = err.statusCode || err.status || 500;

    res.status(statusCode).json(generateResponse(false, message, isDevelopment ? {
        stack: err.stack,
        error: err
    } : undefined));
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Application specific logging, throwing an error, or other logic here
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Graceful shutdown
    process.exit(1);
});

module.exports = errorHandler;
