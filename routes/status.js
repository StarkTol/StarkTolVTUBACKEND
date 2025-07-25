// routes/status.js
const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { generateResponse } = require('../utils/helpers');

router.get('/database', async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);

    if (error) {
      return res.status(500).json(generateResponse(false, 'Database connection failed', {
        error: error.message
      }));
    }

    res.json(generateResponse(true, 'Supabase database connected successfully', {
      status: 'connected',
      timestamp: new Date().toISOString()
    }));
  } catch (err) {
    res.status(500).json(generateResponse(false, 'Error checking database connection', {
      error: err.message
    }));
  }
});

module.exports = router;
