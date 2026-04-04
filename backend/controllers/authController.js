// controllers/authController.js — Register, Login, Verify, Reset
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../utils/emailService");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const userResponse = (user, token) => ({
  token,
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    isVerified: user.isVerified,
    avatar: user.avatar,
  },
});

// ─── POST /api/auth/register ──────────────────────────────────
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "Name, email and password are required." });
    if (password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters." });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists)
      return res.status(409).json({ error: "An account with this email already exists." });

    // Generate email verification token
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      verifyToken,
      verifyExpires,
    });

    // Send verification email (non-blocking – don't fail registration if email fails)
    sendVerificationEmail(user.email, user.name, verifyToken).catch((e) =>
      console.error("Verify email failed:", e.message)
    );

    const token = signToken(user._id);
    res.status(201).json({
      message: "Account created! Please check your email to verify your account.",
      ...userResponse(user, token),
    });
  } catch (err) {
    console.error("register error:", err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
};

// ─── POST /api/auth/login ─────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required." });

    // Explicitly select password (it's hidden by default)
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ error: "Incorrect email or password." });

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);
    res.json({
      message: "Login successful!",
      ...userResponse(user, token),
    });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
};

// ─── GET /api/auth/verify-email?token=xxx ─────────────────────
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    const user = await User.findOne({
      verifyToken: token,
      verifyExpires: { $gt: new Date() },
    });
    if (!user)
      return res.status(400).json({ error: "Invalid or expired verification link." });

    user.isVerified = true;
    user.verifyToken = null;
    user.verifyExpires = null;
    await user.save({ validateBeforeSave: false });

    res.json({ message: "Email verified! You can now log in." });
  } catch (err) {
    res.status(500).json({ error: "Verification failed." });
  }
};

// ─── POST /api/auth/forgot-password ──────────────────────────
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    // Always return success to prevent email enumeration
    if (!user) return res.json({ message: "If that email exists, a reset link was sent." });

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetToken = resetToken;
    user.resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await user.save({ validateBeforeSave: false });

    await sendPasswordResetEmail(user.email, user.name, resetToken);
    res.json({ message: "Password reset link sent to your email." });
  } catch (err) {
    console.error("forgotPassword error:", err);
    res.status(500).json({ error: "Could not send reset email. Try again." });
  }
};

// ─── POST /api/auth/reset-password ───────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!password || password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters." });

    const user = await User.findOne({
      resetToken: token,
      resetExpires: { $gt: new Date() },
    });
    if (!user)
      return res.status(400).json({ error: "Invalid or expired reset link." });

    user.password = password;
    user.resetToken = null;
    user.resetExpires = null;
    await user.save();

    res.json({ message: "Password reset successfully. You can now log in." });
  } catch (err) {
    res.status(500).json({ error: "Reset failed. Try again." });
  }
};

// ─── GET /api/auth/me ─────────────────────────────────────────
const getMe = async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      isVerified: req.user.isVerified,
      avatar: req.user.avatar,
      createdAt: req.user.createdAt,
      lastLogin: req.user.lastLogin,
    },
  });
};

module.exports = { register, login, verifyEmail, forgotPassword, resetPassword, getMe };
