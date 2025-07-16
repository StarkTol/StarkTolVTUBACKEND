const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { supabase } = require("../utils/supabase");

const registerUser = async (req, res) => {
  const { full_name, email, phone, password } = req.body;

  if (!full_name || !email || !phone || !password) {
    return res.status(400).json({ success: false, message: "All fields are required." });
  }

  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .or(`email.eq.${email},phone.eq.${phone}`)
    .maybeSingle();

  if (existingUser) {
    return res.status(400).json({ success: false, message: "User already exists." });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const { data, error } = await supabase.from("users").insert([
    { full_name, email, phone, password: hashedPassword }
  ]);

  if (error) {
    return res.status(500).json({ success: false, message: "Error registering user." });
  }

  return res.status(201).json({ success: true, message: "Account created. Please login." });
};

module.exports = { registerUser };
