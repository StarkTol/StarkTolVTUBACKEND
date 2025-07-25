// config/supabaseClient.js
const { createClient } = require('@supabase/supabase-js');
const config = require('./environment');

const { supabase: supabaseConfig } = config.database;
const { url: supabaseUrl, serviceRoleKey: supabaseKey } = supabaseConfig;

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
