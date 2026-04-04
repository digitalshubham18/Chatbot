// middleware/authMiddleware.js — JWT verification
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer "))
      return res.status(401).json({ error: "Not authorized. Please log in." });

    const token = auth.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({
        error: e.name === "TokenExpiredError"
          ? "Session expired. Please log in again."
          : "Invalid token.",
        code: "TOKEN_INVALID",
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: "User not found." });
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: "Auth error." });
  }
};

module.exports = { protect };
