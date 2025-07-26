# StarkTol VTU Backend API

A comprehensive VTU (Virtual Top-Up) and utility service backend platform with reseller system, built using Node.js, Express.js, and Supabase.

## 🚀 Features

### Core Services
- **Authentication & User Management** - Complete user registration, login, and profile management
- **Wallet System** - Balance management, deposits, withdrawals, and transfers
- **VTU Services** - Airtime, data bundles, cable TV, and electricity token purchases
- **Transaction Management** - Comprehensive transaction tracking and history
- **Real-time Updates** - Live balance and transaction status updates

### Business Features
- **Reseller System** - Multi-level reseller management with custom discounts
- **Sub-reseller Management** - Create and manage sub-resellers with commission tracking
- **Referral System** - User referrals with bonus and commission management
- **Support System** - Ticket-based customer support with rating system
- **Subdomain Management** - Custom branded subdomains for resellers

### Advanced Features
- **Role-based Access Control** - Different permission levels for users, resellers, and admins
- **API Management** - API keys and webhook configurations for resellers
- **Analytics & Reporting** - Comprehensive statistics and performance metrics
- **Security** - Rate limiting, input validation, and secure authentication

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Real-time subscriptions
- **Environment**: dotenv for configuration
- **Security**: Helmet, CORS, Rate limiting

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Supabase account and project

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd starktol-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Edit .env with your actual credentials
   # NEVER commit .env to version control!
   ```

4. **Configure Supabase**
   - Create a new Supabase project
   - Get your project URL and API keys
   - Update `.env` with your Supabase credentials

5. **Run the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   
   # Minimal server (for debugging)
   npm run start:minimal
   ```

## 🔐 Environment Configuration

### Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment mode (development/production) | Yes |
| `PORT` | Server port (auto-set by deployment platforms) | No* |
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |

*PORT is automatically set by deployment platforms like Render.com

### Security Notes
- Never commit `.env` file to version control
- Use `.env.example` as a template
- For deployment, set environment variables in your platform's dashboard

## 🏥 Health Endpoints

The API provides multiple health check endpoints:

- **`/health`** - Detailed health information with environment details
- **`/healthz`** - Lightweight health check (optimized for deployment platforms)
- **`/api/status`** - API operational status with service breakdown

```bash
# Test health endpoints
curl http://localhost:8000/health
curl http://localhost:8000/healthz
curl http://localhost:8000/api/status
```

## 🚀 Deployment

### Pre-deployment Validation

Always run validation before deploying:

```bash
# Validate deployment configuration
npm run validate-deployment

# Run pre-deployment checks
npm run pre-deploy
```

### Render.com Deployment

1. **Connect Repository** to Render.com
2. **Configure Build Settings:**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check Path: `/healthz`

3. **Set Environment Variables** in Render Dashboard:
   ```
   NODE_ENV=production
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_key
   ```

4. **Deploy** and monitor logs for any issues

### Common Deployment Issues

| Issue | Root Cause | Solution |
|-------|------------|----------|
| Yellow status on Render | Missing health endpoints | Ensure `/healthz` endpoint exists |
| Port binding errors | Hardcoded port configuration | Use `process.env.PORT \|\| 8000` |
| Environment variable errors | Missing required config | Set all required variables in platform |
| Database connection failed | Wrong Supabase credentials | Verify credentials in platform settings |

📚 **Detailed Guides:**
- [Health Endpoints Documentation](HEALTH_ENDPOINTS.md)
- [Render Deployment Guide](RENDER_DEPLOYMENT_GUIDE.md)
- [Troubleshooting Guide](RENDER_TROUBLESHOOTING.md)
- [Root Cause Analysis](ROOT_CAUSE_ANALYSIS.md)

## 🛡️ Preventive Measures

### Pre-deployment Checklist

- [ ] Run `npm run validate-deployment` ✅
- [ ] All environment variables configured ✅
- [ ] Health endpoints responding ✅
- [ ] Port configuration uses `process.env.PORT` ✅
- [ ] Server binds to `0.0.0.0` ✅
- [ ] No `.env` file in repository ✅
- [ ] Documentation updated ✅

### Configuration Standards

1. **Port Configuration**: Always use `process.env.PORT || 8000`
2. **Environment Variables**: Document all variables in `.env.example`
3. **Health Endpoints**: Maintain `/health`, `/healthz`, and `/api/status`
4. **Security**: Never commit sensitive configuration files
5. **Validation**: Run deployment validation before each deploy

### Automated Checks

The deployment validation script checks:
- ✅ Port configuration consistency
- ✅ Health endpoint availability
- ✅ Environment variable documentation
- ✅ Security best practices
- ✅ Package.json configuration

```bash
# Run all validation checks
npm run validate-deployment
```

## 📊 API Documentation

### Base URL
- **Production**: `https://your-service.onrender.com`
- **Development**: `http://localhost:8000`

### API Structure
```
/api/v1/
├── auth/          # Authentication endpoints
├── users/         # User management
├── wallet/        # Wallet operations
├── vtu/           # VTU services
├── transactions/  # Transaction history
├── resellers/     # Reseller management
└── admin/         # Admin operations
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Run validation: `npm run validate-deployment`
4. Commit your changes
5. Push to the branch
6. Create a Pull Request

## 📝 License

This project is licensed under the ISC License.

---

**Last Updated**: July 25, 2025  
**Status**: Production Ready ✅
