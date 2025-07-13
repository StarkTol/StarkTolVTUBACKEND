// routes/status.js
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabaseClient');

router.get('/database', async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('*').limit(1);

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Database connection failed',
        error: error.message,
      });
    }

    res.json({
      success: true,
      message: 'Supabase database connected successfully',
      sample: data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error checking database connection',
      error: err.message,
    });
  }
});

module.exports = router;
