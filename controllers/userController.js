const supabase = require('../utils/supabase')

// GET /profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) throw error

    res.json({
      wallet_balance: user.wallet_balance || 0,
      total_spent: user.total_spent || 0,
      referral_bonus: user.referral_bonus || 0,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
    })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Unable to fetch profile', error: err.message })
  }
}

// PUT /profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id
    const { full_name, phone } = req.body

    const { error } = await supabase
      .from('users')
      .update({ full_name, phone })
      .eq('id', userId)

    if (error) throw error

    res.json({ success: true, message: 'Profile updated successfully' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Profile update failed', error: err.message })
  }
}

// PUT /change-password
const changePassword = async (req, res) => {
  try {
    const { new_password } = req.body
    const userId = req.user.id

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: new_password
    })

    if (error) throw error

    res.json({ success: true, message: 'Password changed successfully' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Password change failed', error: err.message })
  }
}

module.exports = {
  getProfile,
  updateProfile,
  changePassword
}
