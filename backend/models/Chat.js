// models/Chat.js — Chat session with file attachment support
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true },
  // Optional file attachment info
  attachment: {
    name: { type: String, default: null },
    type: { type: String, default: null }, // "image" | "pdf"
    url:  { type: String, default: null },
  },
  timestamp: { type: Date, default: Date.now },
});

const chatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title:    { type: String, default: "New Conversation" },
    topic:    { type: String, default: "General" },
    language: { type: String, enum: ["en", "hi"], default: "en" },
    messages: [messageSchema],
    isDeleted:{ type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chat", chatSchema);
