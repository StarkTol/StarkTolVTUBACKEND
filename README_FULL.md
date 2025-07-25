# StarkTol VTU Backend

A comprehensive VTU (Virtual Top-Up) platform backend built with Node.js, Express, and Supabase. This enterprise-grade solution provides secure, scalable, and feature-rich APIs for VTU operations including airtime, data, cable TV, and electricity bill payments.

## 🚀 Features

### Core Features
- **User Authentication & Management** - Secure registration, login, and profile management
- **Advanced Wallet System** - Multi-currency support with transaction history
- **VTU Services** - Airtime, Data bundles, Cable TV subscriptions, Electricity bills
- **Transaction Management** - Real-time processing with comprehensive logging
- **Multi-tier Reseller System** - Hierarchical reseller management with custom pricing
- **Referral Program** - Automated referral tracking and bonus distribution
- **Support Ticketing** - Integrated customer support system
- **Real-time Updates** - Live transaction status and balance updates
- **API Key Management** - Secure API access for third-party integrations

### Advanced Features
- **Webhook Support** - Real-time event notifications
- **Rate Limiting** - API protection and fair usage
- **Input Validation** - Comprehensive data validation with Joi
- **Error Handling** - Centralized error management
- **Logging & Monitoring** - Winston logging with multiple transports
- **Security** - Encryption, hashing, and signature verification
- **Subdomain Management** - Multi-tenant architecture support

## 🏗️ Architecture

```
├── config/           # Configuration files
├── controllers/      # Request handlers
├── middlewares/      # Custom middleware
├── models/          # Data models
├── routes/          # API routes
├── services/        # Business logic
├── utils/           # Utility functions
├── docs/            # Documentation
├── examples/        # Usage examples
└── logs/            # Log files
```

## 🛠️ Tech Stack

- **Backend:** Node.js 18+, Express.js 4.x
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth with JWT
- **Security:** Helmet, CORS, Rate Limiting, Encryption
- **Validation:** Joi for schema validation
- **Logging:** Winston with multiple transports
- **HTTP Client:** Axios with retry mechanism
- **Environment:** dotenv for configuration
- **Monitoring:** Built-in health checks and status endpoints

## 📦 Installation

### Prerequisites
- Node.js 18 or higher
- npm or yarn
- Supabase account and project
- VTU provider account (Nellobytes/ClubKonnect)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd StarkTolVTUBACKEND
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Test connections**
   ```bash
   npm run check
   ```

5. **Start the server**
   ```bash
   npm start      # Production
   npm run dev    # Development with nodemon
   ```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file based on `.env.example`. Key variables include:

#### Core Configuration
```env
NODE_ENV=production
PORT=5000
BASE_URL=https://your-domain.com
API_PREFIX=/api/v1
```

#### Database (Supabase)
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
```

#### VTU Provider (Nellobytes)
```env
NELLOBYTES_BASE_URL=https://api.nellobytesystems.com
NELLOBYTES_USERNAME=your_username
NELLOBYTES_PASSWORD=your_password
NELLOBYTES_AUTH_TYPE=basic
```

#### Payment (Flutterwave)
```env
FLW_PUBLIC_KEY=your_public_key
FLW_SECRET_KEY=your_secret_key
FLW_ENCRYPTION_KEY=your_encryption_key
```

### Database Setup

The system uses Supabase with predefined tables:
- `users` - User accounts and profiles
- `wallets` - User wallet balances
- `transactions` - Transaction history
- `referrals` - Referral tracking
- `support_tickets` - Support system
- `resellers` - Reseller management

## 📚 API Documentation

### Base URL
```
Production: https://your-domain.com/api/v1
Development: http://localhost:8000/api/v1
```

### Authentication
Most endpoints require Bearer token authentication:
```
Authorization: Bearer <your_jwt_token>
```

### Key Endpoints

#### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `GET /auth/profile` - Get user profile

#### VTU Services
- `GET /vtu/networks` - Get available networks
- `GET /vtu/data-plans/:network` - Get data plans
- `POST /vtu/airtime` - Purchase airtime
- `POST /vtu/data` - Purchase data bundle
- `POST /vtu/electricity` - Pay electricity bill
- `POST /vtu/cable` - Pay cable TV subscription

#### Wallet Management
- `GET /wallet/balance` - Get wallet balance
- `POST /wallet/fund` - Fund wallet
- `POST /wallet/transfer` - Transfer funds
- `GET /wallet/transactions` - Get transaction history

### API Response Format
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {...},
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

## 🔒 Security Features

- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - PBKDF2 with salt
- **Data Encryption** - AES-256-GCM encryption
- **Input Validation** - Joi schema validation
- **Rate Limiting** - Request throttling
- **CORS Protection** - Cross-origin request handling
- **Helmet Security** - Security headers
- **SQL Injection Protection** - Supabase RLS policies

## 📊 Monitoring & Logging

### Health Checks
- `GET /health` - Basic health check
- `GET /api/v1/status` - Detailed system status

### Logging
- Winston logger with multiple transports
- Console logging (development)
- File logging (production)
- Error tracking and alerting

### Performance Monitoring
- Request/response timing
- Database query monitoring
- VTU provider response times
- Error rate tracking

## 🧪 Testing

### Available Commands
```bash
npm run check          # Test all connections
npm run test-connections  # Test system connections
npm run server         # Start server directly
```

### Connection Testing
The system includes comprehensive connection testing:
- Database connectivity
- VTU provider APIs
- External services
- Environment validation

## 🚀 Deployment

### Production Checklist
- [ ] Environment variables configured
- [ ] Database setup and migrations
- [ ] VTU provider credentials verified
- [ ] SSL certificates installed
- [ ] Monitoring and logging configured
- [ ] Backup strategy implemented
- [ ] Load balancer configured (if needed)

### Deployment Platforms
- **Render** - Current deployment
- **Heroku** - Alternative platform
- **AWS/DigitalOcean** - Custom server deployment
- **Docker** - Containerized deployment

## 📖 Documentation

### Additional Resources
- `docs/NELLOBYTES_CONFIG.md` - Nellobytes integration guide
- `docs/nellobytesHttpHelper.md` - HTTP helper documentation
- `examples/` - Usage examples and code samples
- `SETUP.md` - Detailed setup instructions

### API Documentation
Live API documentation available at:
- Production: `https://your-domain.com/api/v1/docs`
- Development: `http://localhost:8000/api/v1/docs`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and inquiries:
- Email: support@starktolvtu.com
- Documentation: [API Docs](https://docs.starktolvtu.com)
- Issues: [GitHub Issues](https://github.com/your-repo/issues)

---

**StarkTol VTU Backend** - Powering the next generation of VTU platforms. 🚀
