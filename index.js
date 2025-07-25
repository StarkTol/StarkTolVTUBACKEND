// Load environment variables first (handle both local and production)
try {
    require('dotenv').config({ path: require('path').join(__dirname, '.env') });
} catch (error) {
    console.log('ℹ️ No .env file found, using system environment variables');
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

console.log('🚀 Starting StarkTol VTU Backend...');
console.log(`📍 Node Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🌐 Port: ${process.env.PORT || 3000}`);

// Load configuration service with error handling
let config;
try {
    config = require('./config/environment');
    console.log('✅ Configuration loaded successfully');
} catch (error) {
    console.error('❌ Failed to load configuration:', error.message);
    process.exit(1);
}

// Import middlewares
const errorHandler = require('./middlewares/errorHandler');
const { validateEnvVars } = require('./utils/helpers');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user'); // ✅ NEW
const walletRoutes = require('./routes/wallet');
const paymentRoutes = require('./routes/payment'); // ✅ NEW
const webhookRoutes = require('./routes/webhook'); // ✅ NEW
const vtuRoutes = require('./routes/vtu');
const transactionRoutes = require('./routes/transactions');
const resellerRoutes = require('./routes/reseller');
const referralRoutes = require('./routes/referrals');
const supportRoutes = require('./routes/support');
const settingsRoutes = require('./routes/settings');
const subdomainRoutes = require('./routes/subdomain');
const statusRoutes = require('./routes/status');
const statsRoutes = require('./routes/stats'); // ✅ NEW

// Import real-time handler
const { realtimeHandler } = require('./utils/realtimeHandler');

// Configuration is already validated and loaded
console.log('✅ Configuration loaded and validated successfully');
config.logConfigSummary();

const app = express();
const { port } = config.server;
const NODE_ENV = config.env;

// Trust proxy (Render/reverse proxy support)
app.set('trust proxy', 1);

// Helmet security
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

// CORS
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = config.server.corsOrigin;
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate Limiting
const limiter = rateLimit({
    windowMs: config.security.rateLimiting.windowMs,
    max: config.security.rateLimiting.maxRequests,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging in development
if (NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
    });
}

// Health Check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'StarkTol API is running',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        version: config.server.apiVersion
    });
});

// Render health check endpoint (fast response)
app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// API Status
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

// API Prefix
const apiPrefix = config.server.apiPrefix;

// Register Routes
app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/user`, userRoutes); // ✅ NEW
app.use(`${apiPrefix}/wallet`, walletRoutes);
app.use(`${apiPrefix}/payment`, paymentRoutes); // ✅ NEW - Payment initiation
app.use(webhookRoutes); // ✅ NEW - Webhooks (no prefix for webhooks)
app.use(`${apiPrefix}/vtu`, vtuRoutes);
app.use(`${apiPrefix}/transactions`, transactionRoutes);
app.use(`${apiPrefix}/reseller`, resellerRoutes);
app.use(`${apiPrefix}/referrals`, referralRoutes);
app.use(`${apiPrefix}/support`, supportRoutes);
app.use(`${apiPrefix}/settings`, settingsRoutes);
app.use(`${apiPrefix}/subdomain`, subdomainRoutes);
app.use(`${apiPrefix}/status`, statusRoutes);
app.use(`${apiPrefix}/stats`, statsRoutes); // ✅ NEW - Statistics

// API Docs
app.get(`${apiPrefix}/docs`, (req, res) => {
    res.json({
        success: true,
        message: 'StarkTol API Documentation',
        version: config.server.apiVersion,
        endpoints: {
            auth: `${apiPrefix}/auth`,
            user: `${apiPrefix}/user`, // ✅ NEW
            wallet: `${apiPrefix}/wallet`,
            payment: `${apiPrefix}/payment`, // ✅ NEW
            vtu: `${apiPrefix}/vtu`,
            transactions: `${apiPrefix}/transactions`,
            reseller: `${apiPrefix}/reseller`,
            referrals: `${apiPrefix}/referrals`,
            support: `${apiPrefix}/support`,
            settings: `${apiPrefix}/settings`,
            subdomain: `${apiPrefix}/subdomain`,
            stats: `${apiPrefix}/stats` // ✅ NEW
        },
        documentation_url: 'https://docs.mystarktol.com'
    });
});

// Realtime Polling Fallback
app.get(`${apiPrefix}/realtime/updates`, async (req, res) => {
    try {
        const userId = req.query.user_id;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }

        const updates = await realtimeHandler.getPendingUpdates(userId);
        res.json({ success: true, data: updates, count: updates.length });
    } catch (error) {
        console.error('Realtime updates error:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve updates' });
    }
});

// 404 Catch-all
app.all('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        timestamp: new Date().toISOString()
    });
});

// Global Error Handler
app.use(errorHandler);

// Init Realtime
realtimeHandler.init();
realtimeHandler.startCleanupInterval();

// Graceful Shutdown
const gracefulShutdown = (signal) => {
    console.log(`\n🔄 Received ${signal}. Starting graceful shutdown...`);
    server.close(() => {
        console.log('✅ HTTP server closed');
        realtimeHandler.shutdown();
        process.exit(0);
    });

    setTimeout(() => {
        console.error('❌ Could not close in time. Forcing shutdown.');
        process.exit(1);
    }, 30000);
};

// Start Server
const server = app.listen(port, '0.0.0.0', () => {
    console.log('\n🚀 StarkTol VTU Backend Server Started!');
    console.log('==========================================');
    console.log(`📍 Environment: ${NODE_ENV}`);
    console.log(`🌐 Server running on: http://0.0.0.0:${port}`);
    console.log(`📡 API Base URL: http://0.0.0.0:${port}${apiPrefix}`);
    console.log(`💊 Health Check: http://0.0.0.0:${port}/health`);
    console.log(`🔍 Render Health: http://0.0.0.0:${port}/healthz`);
    console.log(`📚 API Docs: http://0.0.0.0:${port}${apiPrefix}/docs`);
    console.log('==========================================');
    console.log('🎯 Services Available:');
    console.log('   - Authentication & User Management');
    console.log('   - Wallet & Balance');
    console.log('   - VTU Services');
    console.log('   - Transactions');
    console.log('   - Reseller System');
    console.log('   - Referral Program');
    console.log('   - Support Tickets');
    console.log('   - Settings');
    console.log('   - Subdomain Management');
    console.log('   - Realtime Updates');
    console.log('\n✨ Ready to serve requests!\n');
});

// Handle Signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unexpected exceptions
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
    process.exit(1);
});

module.exports = app;
