const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import middlewares
const errorHandler = require('./middlewares/errorHandler');
const { validateEnvVars } = require('./utils/helpers');

// Import routes
const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const vtuRoutes = require('./routes/vtu');
const transactionRoutes = require('./routes/transactions');
const resellerRoutes = require('./routes/reseller');
const referralRoutes = require('./routes/referrals');
const supportRoutes = require('./routes/support');
const settingsRoutes = require('./routes/settings');
const subdomainRoutes = require('./routes/subdomain');
const statusRoutes = require('./routes/status');

// Import real-time handler
const { realtimeHandler } = require('./utils/realtimeHandler');

// Validate required environment variables
const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
];

try {
    validateEnvVars(requiredEnvVars);
    console.log('✅ Environment variables validated successfully');
} catch (error) {
    console.error('❌ Environment validation failed:', error.message);
    process.exit(1);
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = process.env.CORS_ORIGIN ? 
            process.env.CORS_ORIGIN.split(',') : 
            ['http://localhost:3000', 'http://localhost:5000'];
        
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Request logging middleware (development only)
if (NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
    });
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'StarkTol API is running',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        version: process.env.API_VERSION || 'v1'
    });
});

// API status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        message: 'StarkTol API is operational',
        services: {
            database: 'connected',
            vtu_service: 'operational',
            real_time: 'active'
        },
        timestamp: new Date().toISOString()
    });
});

// API Routes
const apiPrefix = process.env.API_PREFIX || '/api/v1';

app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/wallet`, walletRoutes);
app.use(`${apiPrefix}/vtu`, vtuRoutes);
app.use(`${apiPrefix}/transactions`, transactionRoutes);
app.use(`${apiPrefix}/reseller`, resellerRoutes);
app.use(`${apiPrefix}/referrals`, referralRoutes);
app.use(`${apiPrefix}/support`, supportRoutes);
app.use(`${apiPrefix}/settings`, settingsRoutes);
app.use(`${apiPrefix}/subdomain`, subdomainRoutes);
app.use(`${apiPrefix}/status`, statusRoutes);

// API documentation route
app.get(`${apiPrefix}/docs`, (req, res) => {
    res.json({
        success: true,
        message: 'StarkTol API Documentation',
        version: process.env.API_VERSION || 'v1',
        endpoints: {
            auth: `${apiPrefix}/auth`,
            wallet: `${apiPrefix}/wallet`,
            vtu: `${apiPrefix}/vtu`,
            transactions: `${apiPrefix}/transactions`,
            reseller: `${apiPrefix}/reseller`,
            referrals: `${apiPrefix}/referrals`,
            support: `${apiPrefix}/support`,
            settings: `${apiPrefix}/settings`,
            subdomain: `${apiPrefix}/subdomain`
        },
        documentation_url: 'https://docs.mystarktol.com'
    });
});

// Real-time updates endpoint (polling fallback)
app.get(`${apiPrefix}/realtime/updates`, async (req, res) => {
    try {
        const userId = req.query.user_id;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const updates = await realtimeHandler.getPendingUpdates(userId);
        
        res.json({
            success: true,
            data: updates,
            count: updates.length
        });

    } catch (error) {
        console.error('Get realtime updates error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve updates'
        });
    }
});

// Catch-all route for undefined endpoints
app.all('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize real-time handler
realtimeHandler.init();
realtimeHandler.startCleanupInterval();

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
    console.log(`\n🔄 Received ${signal}. Starting graceful shutdown...`);
    
    // Stop accepting new connections
    server.close(() => {
        console.log('✅ HTTP server closed');
        
        // Shutdown real-time handler
        realtimeHandler.shutdown();
        
        // Exit process
        process.exit(0);
    });

    // Force close after 30 seconds
    setTimeout(() => {
        console.error('❌ Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 30000);
};

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 StarkTol VTU Backend Server Started!');
    console.log('==========================================');
    console.log(`📍 Environment: ${NODE_ENV}`);
    console.log(`🌐 Server running on: http://0.0.0.0:${PORT}`);
    console.log(`📡 API Base URL: http://0.0.0.0:${PORT}${apiPrefix}`);
    console.log(`💊 Health Check: http://0.0.0.0:${PORT}/health`);
    console.log(`📚 API Docs: http://0.0.0.0:${PORT}${apiPrefix}/docs`);
    console.log('==========================================');
    
    if (NODE_ENV === 'development') {
        console.log('🔧 Development mode features:');
        console.log('   - Request logging enabled');
        console.log('   - Detailed error messages');
        console.log('   - CORS origins:', process.env.CORS_ORIGIN || 'localhost:3000,localhost:5000');
    }
    
    console.log('\n🎯 Available Services:');
    console.log('   - Authentication & User Management');
    console.log('   - Wallet & Balance Management');
    console.log('   - VTU Services (Airtime, Data, Cable, Electricity)');
    console.log('   - Transaction Management');
    console.log('   - Reseller & Sub-reseller System');
    console.log('   - Referral Management');
    console.log('   - Support Ticket System');
    console.log('   - Settings & Configuration');
    console.log('   - Subdomain Management');
    console.log('   - Real-time Updates');
    console.log('\n✨ Ready to serve requests!\n');
});

// Handle process signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

module.exports = app;
