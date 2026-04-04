const express = require("express");
const router = express.Router();
const { handleChat, getSessions, getSessionMessages, deleteSession } = require("../controllers/chatController");
const { protect } = require("../middleware/authMiddleware");
const { chatLimiter } = require("../middleware/rateLimiter");
const upload = require("../middleware/upload");

router.use(protect);
router.post("/", chatLimiter, upload.single("file"), handleChat);
router.get("/sessions", getSessions);
router.get("/sessions/:chatId", getSessionMessages);
router.delete("/sessions/:chatId", deleteSession);

module.exports = router;
