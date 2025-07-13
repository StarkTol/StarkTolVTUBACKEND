const { supabase, supabaseAdmin } = require('../config/supabase');
const { validateEmail, validatePassword } = require('../utils/validators');
const { generateResponse } = require('../utils/helpers');

class AuthController {
    // User registration
    async register(req, res) {
        try {
            const { email, password, full_name, phone, referral_code } = req.body;

            // Validate input
            if (!validateEmail(email)) {
                return res.status(400).json(generateResponse(false, 'Invalid email format'));
            }

            if (!validatePassword(password)) {
                return res.status(400).json(generateResponse(false, 'Password must be at least 8 characters long'));
            }

            if (!full_name || !phone) {
                return res.status(400).json(generateResponse(false, 'Full name and phone are required'));
            }

            // Check if user already exists
            const { data: existingUser } = await supabase
                .from('users')
                .select('id')
                .eq('email', email)
                .single();

            if (existingUser) {
                return res.status(400).json(generateResponse(false, 'User already exists'));
            }

            // Create user with Supabase Auth
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true
            });

            if (authError) {
                return res.status(400).json(generateResponse(false, authError.message));
            }

            // Process referral if provided
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

            // Generate unique referral code
            const userReferralCode = `STK${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

            // Create user profile
            const { data: userData, error: userError } = await supabase
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
                    wallet_balance: 0.00
                })
                .select()
                .single();

            if (userError) {
                // Cleanup auth user if profile creation fails
                await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
                return res.status(500).json(generateResponse(false, 'Failed to create user profile'));
            }

            // Create wallet entry
            await supabase
                .from('wallets')
                .insert({
                    user_id: userData.id,
                    balance: 0.00,
                    total_deposits: 0.00,
                    total_withdrawals: 0.00
                });

            // Process referral bonus if applicable
            if (referrer_id) {
                const referralBonus = parseFloat(process.env.REFERRAL_BONUS || '100');
                await supabase
                    .from('referrals')
                    .insert({
                        referrer_id,
                        referred_id: userData.id,
                        bonus_amount: referralBonus,
                        status: 'pending'
                    });
            }

            const { password: _, ...userResponse } = userData;
            res.status(201).json(generateResponse(true, 'User registered successfully', userResponse));

        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // User login
    async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json(generateResponse(false, 'Email and password are required'));
            }

            // Authenticate with Supabase
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (authError) {
                return res.status(401).json(generateResponse(false, 'Invalid credentials'));
            }

            // Get user profile
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', authData.user.id)
                .single();

            if (userError || !userData) {
                return res.status(404).json(generateResponse(false, 'User profile not found'));
            }

            // Check if user is active
            if (userData.status !== 'active') {
                return res.status(403).json(generateResponse(false, 'Account is suspended'));
            }

            // Update last login
            await supabase
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', userData.id);

            const { password: _, ...userResponse } = userData;
            
            res.json(generateResponse(true, 'Login successful', {
                user: userResponse,
                access_token: authData.session.access_token,
                refresh_token: authData.session.refresh_token
            }));

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // User logout
    async logout(req, res) {
        try {
            const { error } = await supabase.auth.signOut();
            
            if (error) {
                return res.status(400).json(generateResponse(false, error.message));
            }

            res.json(generateResponse(true, 'Logged out successfully'));

        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get current user profile
    async getProfile(req, res) {
        try {
            const userId = req.user.id;

            const { data: userData, error } = await supabase
                .from('users')
                .select(`
                    *,
                    wallets!inner(balance, total_deposits, total_withdrawals)
                `)
                .eq('id', userId)
                .single();

            if (error || !userData) {
                return res.status(404).json(generateResponse(false, 'User not found'));
            }

            const { password: _, ...userResponse } = userData;
            res.json(generateResponse(true, 'Profile retrieved successfully', userResponse));

        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Update user profile
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
            res.json(generateResponse(true, 'Profile updated successfully', userResponse));

        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Change password
    async changePassword(req, res) {
        try {
            const { current_password, new_password } = req.body;

            if (!current_password || !new_password) {
                return res.status(400).json(generateResponse(false, 'Current and new passwords are required'));
            }

            if (!validatePassword(new_password)) {
                return res.status(400).json(generateResponse(false, 'New password must be at least 8 characters long'));
            }

            // Verify current password by attempting login
            const { error: verifyError } = await supabase.auth.signInWithPassword({
                email: req.user.email,
                password: current_password
            });

            if (verifyError) {
                return res.status(400).json(generateResponse(false, 'Current password is incorrect'));
            }

            // Update password
            const { error: updateError } = await supabase.auth.updateUser({
                password: new_password
            });

            if (updateError) {
                return res.status(400).json(generateResponse(false, updateError.message));
            }

            res.json(generateResponse(true, 'Password changed successfully'));

        } catch (error) {
            console.error('Change password error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }
}

module.exports = new AuthController();
