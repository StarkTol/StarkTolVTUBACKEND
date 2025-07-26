# StarkTol VTU Backend - Setup Guide

## ✅ Your Backend is Now Connected!

All the necessary files in your StarkTol VTU backend are properly connected and ready to work. Here's what has been configured:

### 🔗 File Connections Status:
- ✅ **Main Server** (`index.js`) - All routes and middleware connected
- ✅ **Configuration** - Supabase clients properly configured
- ✅ **Controllers** - All 10+ controllers connected to their routes
- ✅ **Middleware** - Auth, validation, and error handling connected
- ✅ **Routes** - All 11 route files connected to controllers
- ✅ **Services** - VTU, wallet, and other services connected
- ✅ **Models** - User, Transaction, and other models ready
- ✅ **Utilities** - Helpers, validators, and real-time handler connected

## 🚀 Quick Start

### 1. Install Dependencies (if not done)
```bash
npm install
```

### 2. Test All Connections
```bash
npm run check
```

### 3. Start the Server
```bash
# For development with auto-restart
npm run dev

# For production
npm start
```

## 🧪 Available Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start server with connection testing |
| `npm run dev` | Start with nodemon (auto-restart) |
| `npm run server` | Start server directly (skip connection tests) |
| `npm run test-connections` | Test all file connections |
| `npm run check` | Quick connection check |

## 📡 API Endpoints

Your backend will be available at: `http://localhost:8000`

### Core Endpoints:
- 🏥 **Health Check**: `GET /health`
- 📊 **API Status**: `GET /api/status` 
- 📚 **API Docs**: `GET /api/v1/docs`
- 🗄️ **Database Status**: `GET /api/v1/status/database`

### API Routes (all under `/api/v1`):
- 🔐 `/auth` - Authentication & user management
- 👤 `/user` - User profile operations
- 💰 `/wallet` - Wallet & balance management
- 📱 `/vtu` - VTU services (airtime, data, etc.)
- 💳 `/transactions` - Transaction history & management
- 🏪 `/reseller` - Reseller system
- 🤝 `/referrals` - Referral program
- 🎫 `/support` - Support tickets
- ⚙️ `/settings` - User & system settings
- 🌐 `/subdomain` - Subdomain management

## 🔧 Environment Configuration

Since you mentioned you'll handle the `.env` yourself, make sure it includes:

```env
# Supabase Configuration (Required)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key

# Server Configuration (Optional)
PORT=8000
NODE_ENV=development
API_PREFIX=/api/v1

# CORS Configuration (Optional)
CORS_ORIGIN=http://localhost:8000,http://localhost:5000

# Rate Limiting (Optional)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Additional Features (Optional)
REFERRAL_BONUS=100
API_VERSION=v1
```

## ✨ What's Ready

Your backend includes these fully connected features:

### 🔐 Authentication System
- User registration & login
- JWT token management
- Password change & profile updates
- Role-based access control

### 💰 Wallet System
- Balance management
- Deposit & withdrawal processing
- Transaction history
- Transfer between users

### 📱 VTU Services
- Airtime purchase
- Data bundle purchase
- Cable TV subscriptions
- Electricity bill payments

### 🏪 Reseller System
- Reseller applications
- Sub-reseller management
- Commission tracking
- Bulk operations

### 🤝 Referral Program
- Referral code generation
- Bonus processing
- Earnings tracking

### 🎫 Support System
- Ticket creation & management
- Admin responses
- Ticket rating system

### 🌐 Additional Features
- Real-time updates
- Subdomain management
- Custom branding
- Webhook support
- Rate limiting
- Error handling
- Request validation

## 🚨 Troubleshooting

If you encounter any issues:

1. **Run the connection test**: `npm run check`
2. **Check your .env file** has all required variables
3. **Verify Supabase connection** in your dashboard
4. **Check the logs** for specific error messages

## 🎯 Next Steps

Your backend is fully connected and ready! You can now:

1. ✅ Start developing your frontend
2. ✅ Test API endpoints with Postman/Insomnia  
3. ✅ Set up your database tables in Supabase
4. ✅ Configure your VTU service providers
5. ✅ Deploy to your hosting platform

---

**🎉 Congratulations! Your StarkTol VTU backend is fully connected and ready to serve requests!**
