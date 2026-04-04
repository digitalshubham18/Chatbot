const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { error: "Too many requests. Wait 15 minutes." },
});

const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 60,
  message: { error: "Too many messages. Wait a moment." },
});

module.exports = { authLimiter, chatLimiter };
