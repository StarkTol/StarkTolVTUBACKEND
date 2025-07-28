const { supabase, supabaseAdmin } = require('../config/supabaseClient');
const { validateEmail, validatePassword, validatePhoneNumber, sanitizeEmail, sanitizeInput } = require('../utils/validators');
const { generateResponse, parsePhoneNumber } = require('../utils/helpers');
const bcrypt = require('bcryptjs');

class UserController {
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

  // GET /profile - Get User Profile
  async getProfile(req, res) {
    try {
      const userId = req.user.id;

      console.log('📱 Getting user profile:', userId);

      // Get user profile with wallet information
      const { data: userData, error } = await supabase
        .from('users')
        .select(`
          *,
          wallets!inner(
            balance,
            total_deposits,
            total_withdrawals,
            total_spent
          )
        `)
        .eq('id', userId)
        .single();

      if (error || !userData) {
        console.error('❌ Failed to get user profile:', error);
        return res.status(404).json(generateResponse(false, 'User profile not found'));
      }

      // Remove sensitive data
      const { password, created_at, updated_at, ...userResponse } = userData;

      console.log('✅ Profile retrieved successfully:', userData.email);

      return res.json(generateResponse(true, 'Profile retrieved successfully', {
        user: userResponse,
        wallet: userData.wallets || { balance: 0, total_deposits: 0, total_withdrawals: 0, total_spent: 0 }
      }));

    } catch (error) {
      console.error('🔥 Get profile error:', error);
      return res.status(500).json(generateResponse(false, 'Internal server error'));
    }
  }

  // PUT /profile - Update Profile Info (name, email, phone)
  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { full_name, email, phone } = req.body;
      const clientIP = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      console.log('📝 Updating user profile:', userId);

      // Input validation and sanitization
      const sanitizedFullName = sanitizeInput(full_name);
      const sanitizedEmail = email ? sanitizeEmail(email) : null;
      const sanitizedPhone = sanitizeInput(phone);

      // Validate inputs
      if (!sanitizedFullName || sanitizedFullName.length < 2) {
        return res.status(400).json(generateResponse(false, 'Full name must be at least 2 characters long'));
      }

      if (sanitizedEmail && !validateEmail(sanitizedEmail)) {
        return res.status(400).json(generateResponse(false, 'Invalid email format'));
      }

      if (!validatePhoneNumber(sanitizedPhone)) {
        return res.status(400).json(generateResponse(false, 'Invalid phone number format'));
      }

      // Check if email or phone already exists (if being updated)
      if (sanitizedEmail && sanitizedEmail !== req.user.email) {
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('email', sanitizedEmail)
          .neq('id', userId)
          .single();

        if (existingUser) {
          return res.status(400).json(generateResponse(false, 'Email already exists'));
        }
      }

      if (sanitizedPhone !== req.user.phone) {
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('phone', parsePhoneNumber(sanitizedPhone))
          .neq('id', userId)
          .single();

        if (existingUser) {
          return res.status(400).json(generateResponse(false, 'Phone number already exists'));
        }
      }

      // Update user profile
      const updateData = {
        full_name: sanitizedFullName,
        phone: parsePhoneNumber(sanitizedPhone),
        updated_at: new Date().toISOString()
      };

      // Only update email if provided and different
      if (sanitizedEmail && sanitizedEmail !== req.user.email) {
        updateData.email = sanitizedEmail;
        updateData.email_verified = false; // Reset email verification if email changed
      }

      const { data: userData, error } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to update profile:', error);
        return res.status(400).json(generateResponse(false, 'Failed to update profile'));
      }

      // Update Supabase Auth user metadata if email changed
      if (sanitizedEmail && sanitizedEmail !== req.user.email) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          email: sanitizedEmail,
          user_metadata: {
            full_name: sanitizedFullName,
            phone: parsePhoneNumber(sanitizedPhone)
          }
        });
      }

      // Log activity
      await this.logUserActivity(userId, 'profile_update', {
        ip_address: clientIP,
        user_agent: userAgent,
        fields_updated: Object.keys(updateData)
      });

      const { password, ...userResponse } = userData;

      console.log('✅ Profile updated successfully:', userData.email);

      return res.json(generateResponse(true, 'Profile updated successfully', userResponse));

    } catch (error) {
      console.error('🔥 Update profile error:', error);
      return res.status(500).json(generateResponse(false, 'Internal server error'));
    }
  }

  // PUT /change-password - Change Password (with old password verification)
  async changePassword(req, res) {
    try {
      const userId = req.user.id;
      const { current_password, new_password } = req.body;
      const clientIP = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      console.log('🔐 Changing password for user:', userId);

      // Validate inputs
      if (!current_password || !new_password) {
        return res.status(400).json(generateResponse(false, 'Current password and new password are required'));
      }

      if (!validatePassword(new_password)) {
        return res.status(400).json(generateResponse(false, 'New password must be at least 8 characters long and contain letters and numbers'));
      }

      if (current_password === new_password) {
        return res.status(400).json(generateResponse(false, 'New password must be different from current password'));
      }

      // Verify current password by attempting login
      const { data: authData, error: verifyError } = await supabase.auth.signInWithPassword({
        email: req.user.email,
        password: current_password
      });

      if (verifyError || !authData.user) {
        console.warn('⚠️ Current password verification failed:', req.user.email);
        return res.status(400).json(generateResponse(false, 'Current password is incorrect'));
      }

      // Update password using Supabase Admin
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: new_password
      });

      if (updateError) {
        console.error('❌ Failed to update password:', updateError);
        return res.status(400).json(generateResponse(false, 'Failed to change password'));
      }

      // Update password change timestamp
      await supabaseAdmin
        .from('users')
        .update({
          password_changed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      // Log activity
      await this.logUserActivity(userId, 'password_change', {
        ip_address: clientIP,
        user_agent: userAgent
      });

      console.log('✅ Password changed successfully:', req.user.email);

      return res.json(generateResponse(true, 'Password changed successfully'));

    } catch (error) {
      console.error('🔥 Change password error:', error);
      return res.status(500).json(generateResponse(false, 'Internal server error'));
    }
  }

  // GET /activities - Track user login activity (optional audit logs)
  async getLoginActivities(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, activity_type = 'all' } = req.query;
      const offset = (page - 1) * limit;

      console.log('📋 Getting user activities:', userId);

      let query = supabaseAdmin
        .from('user_activities')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Filter by activity type if specified
      if (activity_type !== 'all') {
        query = query.eq('activity_type', activity_type);
      }

      const { data: activities, error } = await query;

      if (error) {
        console.error('❌ Failed to get activities:', error);
        return res.status(500).json(generateResponse(false, 'Failed to retrieve activities'));
      }

      // Get total count for pagination
      let countQuery = supabaseAdmin
        .from('user_activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (activity_type !== 'all') {
        countQuery = countQuery.eq('activity_type', activity_type);
      }

      const { count } = await countQuery;

      console.log('✅ Activities retrieved successfully:', activities.length);

      return res.json(generateResponse(true, 'Activities retrieved successfully', activities, {
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalRecords: count,
          hasNextPage: count > offset + limit,
          hasPrevPage: page > 1,
          limit: parseInt(limit)
        }
      }));

    } catch (error) {
      console.error('🔥 Get activities error:', error);
      return res.status(500).json(generateResponse(false, 'Internal server error'));
    }
  }
}

module.exports = new UserController();
