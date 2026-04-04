// server.js — LexBot v3
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const chatRoutes = require("./routes/chatRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({ contentSecurityPolicy: false }));

const allowed = [
  process.env.CLIENT_URL || "http://127.0.0.1:5500",
  "http://localhost:5500", "http://localhost:3000",
  "http://127.0.0.1:3000", "http://127.0.0.1:5173", "http://localhost:5173","http://127.0.0.1:5502"
];

app.use(cors({
  origin: (origin, cb) => (!origin || allowed.includes(origin) ? cb(null, true) : cb(new Error("CORS"))),
  methods: ["GET","POST","DELETE","PATCH","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  exposedHeaders: ["X-Chat-Id","X-Chat-Title"],
  credentials: true,
}));

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.get("/api/health", (req, res) => res.json({ status: "OK", time: new Date() }));

app.use((req, res) => res.status(404).json({ error: "Not found." }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || "Server error." });
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n⚖️  LexBot v3`);
    console.log(`🚀 http://localhost:${PORT}`);
    console.log(`🔐 Auth: /api/auth  💬 Chat: /api/chat\n`);
  });
});
