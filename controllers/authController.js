const { supabase, supabaseAdmin } = require('../config/supabaseClient');
const { validateEmail, validatePassword, validatePhoneNumber, sanitizeEmail, sanitizeInput } = require('../utils/validators');
const { generateResponse, generateReference, parsePhoneNumber } = require('../utils/helpers');
const jwtService = require('../services/jwtService');

class AuthController {
  // Check if email exists
  async checkEmail(req, res) {
    const email = req.query.email;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    try {
      const User = require('../models/User');
      const user = await User.findByEmail(email);
      res.json({ success: true, exists: !!user });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }
  // Generate JWT tokens
  generateTokens(userId, email) {
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    const accessTokenExpiry = process.env.JWT_EXPIRES_IN || '1h';
    const refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

    const accessToken = jwt.sign(
      { 
        sub: userId, 
        email, 
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
      },
      jwtSecret
    );

    const refreshToken = jwt.sign(
      { 
        sub: userId, 
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
      },
      jwtSecret
    );

    return { accessToken, refreshToken };
  }

  // Log user activity
  async logUserActivity(userId, activity, metadata = {}) {
    try {
      await supabaseAdmin.from('user_activities').insert({
        user_id: userId,
        activity_type: activity,
        metadata: metadata,
        ip_address: metadata.ip_address || null,
        user_agent: metadata.user_agent || null,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log user activity:', error);
    }
  }

  async register(req, res) {
    try {
  const { email, password, first_name, last_name, phone, referral_code } = req.body;
      const clientIP = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      console.log("📩 Registration attempt:", email);

      // Sanitize inputs
      const sanitizedEmail = sanitizeEmail(email);
  const sanitizedFirstName = sanitizeInput(first_name);
  const sanitizedLastName = sanitizeInput(last_name);
  const sanitizedFullName = `${sanitizedFirstName} ${sanitizedLastName}`.trim();
      const sanitizedPhone = sanitizeInput(phone);

      // Validate inputs
      if (!validateEmail(sanitizedEmail)) {
        return res.status(400).json(generateResponse(false, 'Invalid email format'));
      }

      if (!validatePassword(password)) {
        return res.status(400).json(generateResponse(false, 'Password must be at least 8 characters long and contain letters and numbers'));
      }

      if (!sanitizedFirstName || sanitizedFirstName.length < 1) {
        return res.status(400).json(generateResponse(false, 'First name is required'));
      }
      if (!sanitizedLastName || sanitizedLastName.length < 1) {
        return res.status(400).json(generateResponse(false, 'Last name is required'));
      }

      if (!validatePhoneNumber(sanitizedPhone)) {
        return res.status(400).json(generateResponse(false, 'Invalid phone number format'));
      }

      // Check if user already exists
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id, email')
        .or(`email.eq.${sanitizedEmail},phone.eq.${sanitizedPhone}`)
        .single();

      if (existingUser) {
        console.warn("⚠️ User already exists:", sanitizedEmail);
        return res.status(400).json(generateResponse(false, 'User with this email or phone already exists'));
      }

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: sanitizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: sanitizedFullName,
          phone: sanitizedPhone
        }
      });

      if (authError) {
        console.error("❌ Supabase Auth error:", authError);
        return res.status(400).json(generateResponse(false, authError.message));
      }

      // Handle referral
      let referrer_id = null;
      if (referral_code) {
        const { data: referrer } = await supabaseAdmin
          .from('users')
          .select('id, full_name')
          .eq('referral_code', referral_code.toUpperCase())
          .eq('status', 'active')
          .single();

        if (referrer) {
          referrer_id = referrer.id;
        }
      }

      // Generate unique referral code
      const userReferralCode = generateReference('REF', 8);
      const parsedPhone = parsePhoneNumber(sanitizedPhone);

      // Create user profile
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authData.user.id,
          email: sanitizedEmail,
          full_name: sanitizedFullName,
          phone: parsedPhone,
          referral_code: userReferralCode,
          referred_by: referrer_id,
          role: 'user',
          status: 'active',
          email_verified: true,
          phone_verified: false,
          last_login: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (userError) {
        console.error("❌ Failed to insert user profile:", userError);
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return res.status(500).json(generateResponse(false, 'Failed to create user profile'));
      }

      // Create wallet
      await supabaseAdmin.from('wallets').insert({
        user_id: userData.id,
        balance: 0.00,
        total_deposits: 0.00,
        total_withdrawals: 0.00,
        total_spent: 0.00,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Handle referral bonus
      if (referrer_id) {
        const referralBonus = parseFloat(process.env.REFERRAL_BONUS || '100');
        await supabaseAdmin.from('referrals').insert({
          referrer_id,
          referred_id: userData.id,
          bonus_amount: referralBonus,
          status: 'pending',
          created_at: new Date().toISOString()
        });
      }


      const { password: _, ...userResponse } = userData;
      console.log("✅ Registration successful:", userResponse.email);
      
      return res.status(201).json(generateResponse(true, 'User registered successfully', {
        user: userResponse,
        message: 'Please proceed to login with your credentials'
      }));

    } catch (error) {
      console.error("🔥 Registration error:", error);
      return res.status(500).json(generateResponse(false, 'Internal server error'));
    }
  }

  async login(req, res) {
    try {
      const { email, password, remember_me = false } = req.body;
      const clientIP = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      console.log("🔐 Login attempt:", email);

      // Sanitize email
      const sanitizedEmail = sanitizeEmail(email);

      if (!sanitizedEmail || !password) {
        return res.status(400).json(generateResponse(false, 'Email and password are required'));
      }

      if (!validateEmail(sanitizedEmail)) {
        return res.status(400).json(generateResponse(false, 'Invalid email format'));
      }

      // Attempt authentication
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ 
        email: sanitizedEmail, 
        password 
      });

      if (authError) {
        console.warn("⚠️ Login failed:", sanitizedEmail, authError.message);
        return res.status(401).json(generateResponse(false, 'Invalid credentials'));
      }

      // Get user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*, wallets(balance, total_deposits, total_withdrawals, total_spent)')
        .eq('id', authData.user.id)
        .single();

      if (userError || !userData) {
        console.error("❌ User profile not found:", authData.user.id);
        return res.status(404).json(generateResponse(false, 'User profile not found'));
      }

      // Check account status
      if (userData.status !== 'active') {
        return res.status(403).json(generateResponse(false, 'Account is suspended. Please contact support.'));
      }

      // Update last login
      await supabaseAdmin
        .from('users')
        .update({ 
          last_login: new Date().toISOString(),
          login_count: (userData.login_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', userData.id);

      // Store refresh token in database for security
      await supabaseAdmin.from('user_sessions').insert({
        user_id: userData.id,
        refresh_token: authData.session.refresh_token,
        ip_address: clientIP,
        user_agent: userAgent,
        expires_at: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString(), // 7 days
        created_at: new Date().toISOString()
      });

  // Log login activity
  // (removed logUserActivity call)

      const { password: _, ...userResponse } = userData;

      // Set secure cookies
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'Strict' : 'Lax',
      };

      res.cookie('accessToken', authData.session.access_token, {
        ...cookieOptions,
        maxAge: 60 * 60 * 1000, // 1 hour
      });

      res.cookie('refreshToken', authData.session.refresh_token, {
        ...cookieOptions,
        maxAge: remember_me ? (30 * 24 * 60 * 60 * 1000) : (7 * 24 * 60 * 60 * 1000), // 30 days if remember me, else 7 days
      });

      console.log("✅ Login successful:", userResponse.email);

      return res.json(generateResponse(true, 'Login successful', {
        user: userResponse,
        accessToken: authData.session.access_token,
        refreshToken: authData.session.refresh_token,
        expiresIn: 3600, // 1 hour in seconds
        tokenType: 'Bearer'
      }));

    } catch (error) {
      console.error("🔥 Login error:", error);
      return res.status(500).json(generateResponse(false, 'Internal server error'));
    }
  }

  async logout(req, res) {
    try {
      const userId = req.user?.id;
      const refreshToken = req.cookies?.refreshToken || req.body?.refresh_token;
      const clientIP = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.warn("⚠️ Logout error:", error.message);
      }

      // Remove session from database
      if (refreshToken) {
        await supabaseAdmin
          .from('user_sessions')
          .delete()
          .eq('refresh_token', refreshToken);
      }

      // Log logout activity
      if (userId) {
      }

      // Clear cookies
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

      console.log("✅ Logout successful:", userId || 'unknown');
      return res.json(generateResponse(true, 'Logged out successfully'));

    } catch (error) {
      console.error("🔥 Logout error:", error);
      return res.status(500).json(generateResponse(false, 'Internal server error'));
    }
  }

  // Refresh access token
  async refreshToken(req, res) {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refresh_token;

      if (!refreshToken) {
        return res.status(401).json(generateResponse(false, 'Refresh token is required'));
      }

      // Verify refresh token exists in database
      const { data: sessionData, error: sessionError } = await supabaseAdmin
        .from('user_sessions')
        .select('user_id, expires_at')
        .eq('refresh_token', refreshToken)
        .single();

      if (sessionError || !sessionData) {
        return res.status(401).json(generateResponse(false, 'Invalid refresh token'));
      }

      // Check if token is expired
      if (new Date(sessionData.expires_at) < new Date()) {
        // Clean up expired token
        await supabaseAdmin
          .from('user_sessions')
          .delete()
          .eq('refresh_token', refreshToken);
        
        return res.status(401).json(generateResponse(false, 'Refresh token expired'));
      }

      // Refresh the session with Supabase
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
      });

      if (refreshError) {
        console.error("❌ Token refresh error:", refreshError);
        return res.status(401).json(generateResponse(false, 'Failed to refresh token'));
      }

      // Update session in database
      await supabaseAdmin
        .from('user_sessions')
        .update({
          refresh_token: refreshData.session.refresh_token,
          expires_at: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('refresh_token', refreshToken);

      // Set new cookies
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'Strict' : 'Lax',
      };

      res.cookie('accessToken', refreshData.session.access_token, {
        ...cookieOptions,
        maxAge: 60 * 60 * 1000, // 1 hour
      });

      res.cookie('refreshToken', refreshData.session.refresh_token, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return res.json(generateResponse(true, 'Token refreshed successfully', {
        accessToken: refreshData.session.access_token,
        refreshToken: refreshData.session.refresh_token,
        expiresIn: 3600,
        tokenType: 'Bearer'
      }));

    } catch (error) {
      console.error("🔥 Refresh token error:", error);
      return res.status(500).json(generateResponse(false, 'Internal server error'));
    }
  }

  // Get user login activities
  async getActivities(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const { data: activities, error } = await supabaseAdmin
        .from('user_activities')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error("❌ Failed to get activities:", error);
        return res.status(500).json(generateResponse(false, 'Failed to retrieve activities'));
      }

      const { count } = await supabaseAdmin
        .from('user_activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      return res.json(generateResponse(true, 'Activities retrieved successfully', activities, {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalRecords: count,
        hasNextPage: count > offset + limit,
        hasPrevPage: page > 1
      }));

    } catch (error) {
      console.error("🔥 Get activities error:", error);
      return res.status(500).json(generateResponse(false, 'Internal server error'));
    }
  }

  async getProfile(req, res) {
    try {
      const userId = req.user.id;

      const { data: userData, error } = await supabase
        .from('users')
        .select('*, wallets!inner(balance, total_deposits, total_withdrawals)')
        .eq('id', userId)
        .single();

      if (error || !userData) {
        return res.status(404).json(generateResponse(false, 'User not found'));
      }

      const { password: _, ...userResponse } = userData;
      return res.json(generateResponse(true, 'Profile retrieved successfully', userResponse));

    } catch (error) {
      console.error("🔥 Get profile error:", error);
      return res.status(500).json(generateResponse(false, 'Internal server error'));
    }
  }

  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { full_name, phone } = req.body;

      if (!full_name || !phone) {
        return res.status(400).json(generateResponse(false, 'Full name and phone are required'));
      }

      const { data: userData, error } = await supabase
        .from('users')
        .update({
          full_name,
          phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        return res.status(400).json(generateResponse(false, 'Failed to update profile'));
      }

      const { password: _, ...userResponse } = userData;
      return res.json(generateResponse(true, 'Profile updated successfully', userResponse));

    } catch (error) {
      console.error("🔥 Update profile error:", error);
      return res.status(500).json(generateResponse(false, 'Internal server error'));
    }
  }

  async changePassword(req, res) {
    try {
      const { current_password, new_password } = req.body;

      if (!current_password || !new_password) {
        return res.status(400).json(generateResponse(false, 'Current and new passwords are required'));
      }

      if (!validatePassword(new_password)) {
        return res.status(400).json(generateResponse(false, 'New password must be at least 8 characters long'));
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: req.user.email,
        password: current_password,
      });

      if (verifyError) {
        return res.status(400).json(generateResponse(false, 'Current password is incorrect'));
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: new_password });

      if (updateError) {
        return res.status(400).json(generateResponse(false, updateError.message));
      }

      return res.json(generateResponse(true, 'Password changed successfully'));

    } catch (error) {
      console.error("🔥 Change password error:", error);
      return res.status(500).json(generateResponse(false, 'Internal server error'));
    }
  }
}

const controller = new AuthController();
module.exports = controller;
module.exports.checkEmail = controller.checkEmail.bind(controller);
module.exports.register = controller.register.bind(controller);
