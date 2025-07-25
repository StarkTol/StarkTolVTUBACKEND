# 🚀 Render Deployment Guide for StarkTol VTU Backend

This guide will help you deploy your Node.js backend to Render successfully.

## 📋 Prerequisites

1. GitHub repository with your backend code
2. Render account (free tier available)
3. Environment variables configured

## 🔧 Deployment Steps

### Step 1: Prepare Your Repository

1. **Remove .env file from repository** (already done)
   - The .env file contains sensitive information and should never be committed
   - Use environment variables on Render instead

2. **Verify package.json configuration**
   - Start script: `"start": "node index.js"`
   - All dependencies are in `dependencies` (not devDependencies)

### Step 2: Create Render Web Service

1. **Go to Render Dashboard**
   - Visit [render.com](https://render.com)
   - Sign up/Login with GitHub

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your backend repository

3. **Configure Service Settings**
   ```
   Name: starktol-vtu-backend
   Region: Choose closest to your users
   Branch: main (or your default branch)
   Runtime: Node
   Build Command: npm install
   Start Command: npm start
   ```

### Step 3: Configure Environment Variables

In Render Dashboard → Your Service → Environment, add these variables:

#### 🔐 Required Environment Variables

```bash
# Node & Server
NODE_ENV=production
PORT=10000
BASE_URL=https://your-service-name.onrender.com
FRONTEND_URL=https://your-frontend-url.onrender.com
CORS_ORIGIN=https://your-frontend-url.onrender.com

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_JWT_SECRET=your_jwt_secret
SUPABASE_PROJECT_ID=your_project_id

# Authentication
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=1h

# Admin Configuration
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=secure_admin_password
SUPPORT_EMAIL=support@yourdomain.com

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
MAIL_FROM="StarkTol VTU" <noreply@yourdomain.com>

# Payment (Flutterwave)
FLW_PUBLIC_KEY=your_flutterwave_public_key
FLW_SECRET_KEY=your_flutterwave_secret_key
FLW_ENCRYPTION_KEY=your_flutterwave_encryption_key
FLW_WEBHOOK_HASH=your_webhook_hash

# VTU Provider (Clubkonnect)
CLUBKONNECT_BASE_URL=https://www.clubkonnect.com/api/v2
CLUBKONNECT_USERID=your_clubkonnect_userid
CLUBKONNECT_APIKEY=your_clubkonnect_api_key
CLUBKONNECT_CALLBACK_URL=https://your-service-name.onrender.com/api/v1/vtu/callback
CLUBKONNECT_EMAIL=your_clubkonnect_email

# API Configuration
API_PREFIX=/api/v1
API_VERSION=v1
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000

# Features
ENABLE_REFERRALS=true
ENABLE_SUPPORT_SYSTEM=true
ENABLE_WALLET_TOPUP=true
AUTO_REFILL_ENABLED=true
DEFAULT_PAYMENT_METHOD=wallet
DEFAULT_CURRENCY=NGN
DEFAULT_WALLET_BALANCE=0

# Security
SESSION_SECRET=your_secure_session_secret
ENCRYPTION_KEY=your_secure_encryption_key
WEBHOOK_SECRET=your_webhook_secret
API_KEY_SECRET=your_api_key_secret
```

### Step 4: Deploy

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Configure for Render deployment"
   git push origin main
   ```

2. **Render will auto-deploy**
   - Watch the build logs in Render dashboard
   - Deployment takes 5-10 minutes typically

### Step 5: Verify Deployment

1. **Check Service Status**
   - Service should show green "Live" status
   - No yellow/red warning indicators

2. **Test Health Endpoint**
   ```
   GET https://your-service-name.onrender.com/health
   ```
   Should return:
   ```json
   {
     "success": true,
     "message": "StarkTol API is running",
     "timestamp": "2024-01-20T10:30:00.000Z",
     "environment": "production",
     "version": "v1"
   }
   ```

3. **Test API Status**
   ```
   GET https://your-service-name.onrender.com/api/status
   ```

## 🔍 Troubleshooting

### Yellow Status / Service Won't Start

1. **Check Build Logs**
   - Go to Render Dashboard → Your Service → Logs
   - Look for build errors or missing dependencies

2. **Common Issues**
   - Missing environment variables
   - Database connection issues
   - Port binding problems

### Environment Variable Issues

1. **Missing Variables**
   - Check all required variables are set
   - Verify no typos in variable names

2. **Database Connection**
   - Verify Supabase credentials
   - Check if Supabase allows connections from Render IPs

### Port Issues

1. **Port Configuration**
   - Render provides PORT environment variable
   - Our app automatically uses `process.env.PORT`
   - Default fallback is 8000 for local development

## 🚀 Performance Tips

1. **Keep Service Warm**
   - Free tier services sleep after 15 minutes of inactivity
   - Consider upgrading to paid tier for production

2. **Database Optimization**
   - Use connection pooling
   - Monitor Supabase usage

3. **Monitoring**
   - Set up logging
   - Monitor error rates

## 📞 Support

If you encounter issues:

1. Check Render documentation: [render.com/docs](https://render.com/docs)
2. Review service logs in Render dashboard
3. Verify all environment variables are correctly set
4. Test database connectivity

## 🎉 Success!

Once deployed successfully:
- ✅ Service shows green "Live" status
- ✅ Health endpoint responds correctly
- ✅ No error logs in Render dashboard
- ✅ All API endpoints accessible

Your StarkTol VTU Backend is now live on Render! 🚀
