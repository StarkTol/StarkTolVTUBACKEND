const { createClient } = require('@supabase/supabase-js');
const config = require('./environment');

// Supabase configuration from config service
const { supabase: supabaseConfig } = config.database;
const { url: supabaseUrl, anonKey: supabaseAnonKey, serviceRoleKey: supabaseServiceKey } = supabaseConfig;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration. Please check your .env file.');
}

// Client for public operations (auth, user data)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Service client for admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

module.exports = {
    supabase,
    supabaseAdmin
};
