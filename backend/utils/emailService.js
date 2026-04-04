// utils/emailService.js — Email templates for verification & password reset
const nodemailer = require("nodemailer");

const transporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

const baseTemplate = (title, content) => `
<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
  body{margin:0;padding:0;background:#0a0f1a;font-family:'Segoe UI',sans-serif;}
  .wrap{max-width:560px;margin:40px auto;background:#111827;border-radius:16px;overflow:hidden;border:1px solid #1f2d47;}
  .header{background:linear-gradient(135deg,#0c3547,#0e5f6e);padding:40px;text-align:center;}
  .scales{font-size:52px;display:block;margin-bottom:12px;filter:drop-shadow(0 0 16px rgba(14,165,201,.5));}
  .brand{color:#f0e6d0;font-size:28px;font-weight:900;letter-spacing:-1px;margin:0;}
  .brand-sub{color:rgba(255,255,255,.6);font-size:12px;letter-spacing:3px;margin-top:4px;}
  .body{padding:40px 36px;}
  h2{color:#e0eef8;font-size:20px;margin:0 0 12px;}
  p{color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 20px;}
  .code-box{text-align:center;margin:24px 0;}
  .code{display:inline-block;background:#0a0f1a;border:2px solid #1f2d47;border-radius:12px;padding:20px 40px;font-size:36px;font-weight:800;letter-spacing:12px;color:#0ea5c9;font-family:monospace;}
  .btn{display:inline-block;padding:14px 32px;background:#0ea5c9;color:#0a0f1a;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;}
  .warn{background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:8px;padding:14px 18px;color:#fbbf24;font-size:13px;margin-top:20px;}
  .footer{padding:20px 36px;border-top:1px solid #1f2d47;text-align:center;color:#374151;font-size:12px;}
</style></head>
<body><div class="wrap">
  <div class="header">
    <span class="scales">⚖️</span>
    <h1 class="brand">LexBot</h1>
    <div class="brand-sub">AI LEGAL ASSISTANT</div>
  </div>
  <div class="body">${content}</div>
  <div class="footer">LexBot provides general legal information only — not professional advice.<br/>© 2025 LexBot. All rights reserved.</div>
</div></body></html>`;

const sendVerificationEmail = async (email, name, token) => {
  const link = `${process.env.CLIENT_URL || "http://localhost:5500"}/verify-email.html?token=${token}`;
  const html = baseTemplate("Verify Your Email", `
    <h2>Hello, ${name}! 👋</h2>
    <p>Welcome to LexBot. Please verify your email to activate your account and access your full chat history.</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${link}" class="btn">Verify My Email →</a>
    </div>
    <div class="warn">⚠️ This link expires in 24 hours. If you didn't create an account, ignore this email.</div>
  `);
  await transporter().sendMail({
    from: process.env.EMAIL_FROM || `LexBot <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify your LexBot account",
    html,
    text: `Verify your LexBot account: ${link}`,
  });
  console.log(`📧 Verification email → ${email}`);
};

const sendPasswordResetEmail = async (email, name, token) => {
  const link = `${process.env.CLIENT_URL || "http://localhost:5500"}/reset-password.html?token=${token}`;
  const html = baseTemplate("Reset Your Password", `
    <h2>Password Reset</h2>
    <p>Hi ${name}, we received a request to reset your LexBot password. Click below to set a new one:</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${link}" class="btn">Reset Password →</a>
    </div>
    <div class="warn">⚠️ This link expires in 1 hour. If you didn't request this, ignore this email — your password is safe.</div>
  `);
  await transporter().sendMail({
    from: process.env.EMAIL_FROM || `LexBot <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset your LexBot password",
    html,
    text: `Reset your LexBot password: ${link}`,
  });
  console.log(`📧 Reset email → ${email}`);
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
