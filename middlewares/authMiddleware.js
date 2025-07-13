const { supabase } = require('../config/supabase');
const { generateResponse } = require('../utils/helpers');

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json(generateResponse(false, 'Access token is required'));
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify the JWT token with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json(generateResponse(false, 'Invalid or expired token'));
        }

        // Get additional user information from the users table
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (userError || !userData) {
            return res.status(401).json(generateResponse(false, 'User not found'));
        }

        // Check if user is active
        if (userData.status !== 'active') {
            return res.status(403).json(generateResponse(false, 'Account is suspended'));
        }

        // Attach user to request object
        req.user = userData;
        req.token = token;

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json(generateResponse(false, 'Authentication failed'));
    }
};

module.exports = authMiddleware;
