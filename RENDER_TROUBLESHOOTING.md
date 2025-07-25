# 🟡 Render Yellow Status Troubleshooting Guide

If your Render service shows a **yellow status** and is stuck "in progress", follow these steps to diagnose and fix the issue.

## 🔍 Step 1: Check Render Logs

1. **Go to Render Dashboard**
   - Navigate to your service
   - Click on **"Logs"** tab
   - Look for error messages

2. **Common Error Patterns**
   ```bash
   # Environment variable errors
   Missing required configuration: database.supabase.url
   
   # Port binding errors  
   Error: listen EADDRINUSE :::8000
   
   # Module not found
   Cannot find module './config/environment'
   
   # Database connection errors
   Database connection failed
   ```

## 🛠️ Step 2: Quick Fixes

### Fix 1: Use Minimal Server (Immediate Fix)

1. **Change your Render start command temporarily:**
   ```
   Start Command: npm run start:minimal
   ```

2. **This will:**
   - Start a basic server with minimal dependencies
   - Show detailed environment variable information
   - Help identify the exact issue

### Fix 2: Environment Variables

1. **Go to Render Dashboard → Your Service → Environment**

2. **Add these REQUIRED variables:**
   ```bash
   NODE_ENV=production
   PORT=10000
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_anon_key  
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

3. **Add these OPTIONAL variables (to prevent warnings):**
   ```bash
   BASE_URL=https://your-service-name.onrender.com
   CORS_ORIGIN=https://your-frontend-url.onrender.com
   API_PREFIX=/api/v1
   API_VERSION=v1
   ```

### Fix 3: Correct Start Command

**In Render Settings:**
```
Build Command: npm install
Start Command: npm start
```

## 🔧 Step 3: Specific Error Solutions

### Error: "Missing required configuration"

**Solution:** Add missing environment variables in Render Dashboard

```bash
# Required for database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Error: "Port already in use"

**Solution:** Render automatically provides PORT, ensure your code uses:
```javascript
const PORT = process.env.PORT || 8000;
```

### Error: "Cannot find module"

**Solution:** Check that all files exist in your repository:
- All route files in `/routes/` folder
- All middleware files in `/middlewares/` folder  
- All utility files in `/utils/` folder

### Error: "Database connection failed"

**Solution:** 
1. Verify Supabase credentials are correct
2. Check Supabase project is active
3. Ensure database tables exist

## 🚀 Step 4: Testing Deployment

### Test 1: Check Minimal Server
```bash
curl https://your-service.onrender.com/health
```

Expected response:
```json
{
  "success": true,
  "message": "StarkTol API is running (minimal mode)",
  "environment": "production"
}
```

### Test 2: Environment Variables
The minimal server logs will show which variables are missing.

### Test 3: Switch Back to Full Server
Once minimal server works, change start command back to:
```
Start Command: npm start
```

## 📋 Common Deployment Checklist

- [ ] All environment variables set in Render
- [ ] Start command is `npm start`
- [ ] Build command is `npm install`  
- [ ] Repository has all required files
- [ ] No `.env` file in repository (use Render environment variables)
- [ ] Port configuration uses `process.env.PORT`
- [ ] Database credentials are correct

## 🎯 Debugging Commands

### Check Environment Variables
```bash
# In minimal server logs, you'll see:
✅ SUPABASE_URL: Set
❌ SUPABASE_ANON_KEY: Missing
```

### Manual Health Check
```bash
# Test your deployed service
curl -v https://your-service.onrender.com/health
```

### Local Testing
```bash
# Test locally first
npm run start:minimal
```

## 🚨 Emergency Fix

If nothing works, use this minimal configuration:

1. **Create a simple `emergency.js` file:**
```javascript
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8000;

app.get('/', (req, res) => {
  res.json({ message: 'Server is running!', port: PORT });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
```

2. **Change start command to:** `node emergency.js`

3. **Once this works, gradually add back features**

## 📞 Still Need Help?

1. **Check Render logs** for specific error messages
2. **Use minimal server** to isolate the issue  
3. **Verify environment variables** are set correctly
4. **Test locally** before deploying

The yellow status usually indicates the application is starting but failing to complete initialization. Follow these steps systematically to identify and fix the issue.
