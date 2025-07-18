const { supabase, supabaseAdmin } = require('../config/supabase');
const { validateEmail, validatePassword } = require('../utils/validators');
const { generateResponse } = require('../utils/helpers');

class AuthController {
  async register(req, res) {
    try {
      const { email, password, full_name, phone, referral_code } = req.body;

      console.log("📩 Registration attempt:", email);

      if (!validateEmail(email)) {
        return res.status(400).json(generateResponse(false, 'Invalid email format'));
      }

      if (!validatePassword(password)) {
        return res.status(400).json(generateResponse(false, 'Password must be at least 8 characters long'));
      }

      if (!full_name || !phone) {
        return res.status(400).json(generateResponse(false, 'Full name and phone are required'));
      }

      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        console.warn("⚠️ User already exists:", email);
        return res.status(400).json(generateResponse(false, 'User already exists'));
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        console.error("❌ Supabase Auth error:", authError);
        return res.status(400).json(generateResponse(false, authError.message));
      }

      let referrer_id = null;
      if (referral_code) {
        const { data: referrer } = await supabase
          .from('users')
          .select('id')
          .eq('referral_code', referral_code)
          .single();

        if (referrer) {
          referrer_id = referrer.id;
        }
      }

      const userReferralCode = `STK${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authData.user.id,
          email,
          full_name,
          phone,
          referral_code: userReferralCode,
          referred_by: referrer_id,
          role: 'user',
          status: 'active',
          wallet_balance: 0.00,
        })
        .select()
        .single();

      if (userError) {
        console.error("❌ Failed to insert user profile:", userError);
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return res.status(500).json(generateResponse(false, 'Failed to create user profile'));
      }

      await supabaseAdmin.from('wallets').insert({
        user_id: userData.id,
        balance: 0.00,
        total_deposits: 0.00,
        total_withdrawals: 0.00,
      });

      if (referrer_id) {
        const referralBonus = parseFloat(process.env.REFERRAL_BONUS || '100');
        await supabaseAdmin.from('referrals').insert({
          referrer_id,
          referred_id: userData.id,
          bonus_amount: referralBonus,
          status: 'pending',
        });
      }

      const { password: _, ...userResponse } = userData;
      console.log("✅ Registration successful:", userResponse.email);
      return res.status(201).json(generateResponse(true, 'User registered successfully', userResponse));

    } catch (error) {
      console.error("🔥 Registration error:", error);
      return res.status(500).json(generateResponse(false, 'Internal server error'));
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;

      console.log("🔐 Login attempt:", email);

      if (!email || !password) {
        return res.status(400).json(generateResponse(false, 'Email and password are required'));
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        return res.status(401).json(generateResponse(false, 'Invalid credentials'));
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (userError || !userData) {
        return res.status(404).json(generateResponse(false, 'User profile not found'));
      }

      if (userData.status !== 'active') {
        return res.status(403).json(generateResponse(false, 'Account is suspended'));
      }

      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userData.id);

      const { password: _, ...userResponse } = userData;

      // ✅ Set accessToken as httpOnly secure cookie
      res.cookie("accessToken", authData.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: "Lax",
        maxAge: 60 * 60 * 1000, // 1 hour
      });

      return res.json(generateResponse(true, 'Login successful', {
        user: userResponse,
        accessToken: authData.session.access_token,
        refreshToken: authData.session.refresh_token,
      }));

    } catch (error) {
      console.error("🔥 Login error:", error);
      return res.status(500).json(generateResponse(false, 'Internal server error'));
    }
  }

  async logout(req, res) {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return res.status(400).json(generateResponse(false, error.message));
      }

      // ✅ Clear cookie
      res.clearCookie('accessToken');

      return res.json(generateResponse(true, 'Logged out successfully'));

    } catch (error) {
      console.error("🔥 Logout error:", error);
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

module.exports = new AuthController();
