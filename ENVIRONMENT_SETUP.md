# 🔐 Environment Setup Guide - StarkTol VTU Backend

This guide helps you set up environment variables securely.

## 📋 Quick Setup Instructions

### Step 1: Create Local .env File
```bash
# Copy the template
cp .env.example .env

# Edit with your actual values
nano .env  # or use your preferred editor
```

### Step 2: Required Environment Variables

#### 🚀 **Server Configuration**
```bash
NODE_ENV=development  # Use 'production' for deployment
PORT=8000
BASE_URL=https://your-backend-url.onrender.com
FRONTEND_URL=https://your-frontend-url.onrender.com
CORS_ORIGIN=https://your-frontend-url.onrender.com,http://localhost:3000
```

#### 🗄️ **Database (Supabase)**
```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_JWT_SECRET=your_jwt_secret
SUPABASE_PROJECT_ID=your_project_id
```

#### 💳 **Payment (Flutterwave)**
```bash
FLW_PUBLIC_KEY=FLWPUBK-your_public_key
FLW_SECRET_KEY=FLWSECK-your_secret_key  
FLW_ENCRYPTION_KEY=your_encryption_key
FLW_WEBHOOK_HASH=your_webhook_hash
```

#### 📱 **VTU Provider (Clubkonnect)**
```bash
CLUBKONNECT_BASE_URL=https://www.clubkonnect.com/api/v2
CLUBKONNECT_USERID=your_user_id
CLUBKONNECT_APIKEY=your_api_key
CLUBKONNECT_EMAIL=your_email
CLUBKONNECT_CALLBACK_URL=https://your-backend-url.onrender.com/api/v1/vtu/callback
```

## 🚀 Render Deployment

For Render deployment, add these environment variables in your Render Dashboard:

### Critical Variables (Required):
- `NODE_ENV=production`
- `SUPABASE_URL=https://wgvowaefweylltjmbxfk.supabase.co`
- `SUPABASE_ANON_KEY=your_anon_key`
- `SUPABASE_SERVICE_ROLE_KEY=your_service_role_key`

### Optional Variables:
- `BASE_URL=https://your-service.onrender.com`
- `CORS_ORIGIN=https://your-frontend.onrender.com`
- All other variables from your local .env

## 🔒 Security Notes

1. **Never commit .env files** - They contain sensitive data
2. **Use environment variables in production** - More secure than files
3. **Rotate keys regularly** - Change passwords and API keys periodically
4. **Limit access** - Only give credentials to trusted team members

## ✅ Verification

Test your setup:
```bash
# Local development
npm run start:minimal

# Check health endpoint
curl http://localhost:8000/health
```

## 🆘 Troubleshooting

### Missing Environment Variables
- Check Render Dashboard → Environment tab
- Verify all required variables are set
- No typos in variable names

### Database Connection Issues
- Verify Supabase credentials
- Check project ID matches
- Ensure database is active

Your environment is now configured securely! 🎉
