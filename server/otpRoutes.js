const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");

let otpStore = {}; // temporary storage

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD
  }
});

// 📧 SEND OTP
router.post("/send-otp", async (req, res) => {
    console.log("🔥 SEND OTP API HIT");
  console.log("BODY:", req.body);
  const { email } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000);

  otpStore[email] = otp;

  await transporter.sendMail({
    from: process.env.EMAIL,
    to: email,
    subject: "Your OTP Code",
    text: `Your OTP is ${otp}`
  });

  res.json({ message: "OTP sent" });
  // console.log("OTP for", email, "is:", otp);
});

// ✅ VERIFY OTP
router.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  if (otpStore[email] == otp) {
    delete otpStore[email];
    return res.json({ success: true });
  }

  res.json({ success: false });
});

module.exports = router;