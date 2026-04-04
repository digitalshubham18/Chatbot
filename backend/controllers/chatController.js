// // controllers/chatController.js — SSE streaming + file/image/PDF analysis
// const OpenAI = require("openai");
// const fs = require("fs");
// const path = require("path");
// const Chat = require("../models/Chat");

// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// const SYSTEM_PROMPT = `You are LexBot, an expert AI legal information assistant specializing in Indian law.

// Rules:
// - Be concise, clear, and structured. Use numbered lists for steps/procedures.
// - Cover: IPC, CrPC, Constitution, Consumer Protection Act, IT Act, Family Law, Labour Law, RTI, Property Law.
// - If user shares an image or PDF, analyze it carefully for legal content, clauses, rights, or violations.
// - Respond in Hindi if the user writes in Hindi; otherwise respond in English.
// - Keep responses under 350 words unless complexity demands more.
// - NEVER provide professional legal advice. Always end every response with:
// ⚠️ Disclaimer: This is general legal information only — not professional legal advice. Please consult a qualified advocate for your specific situation.`;

// const generateTitle = (msg) => {
//   const w = msg.trim().split(/\s+/).slice(0, 6).join(" ");
//   return msg.trim().split(/\s+/).length > 6 ? w + "…" : w;
// };

// // ─── POST /api/chat — SSE streaming with optional file ────────
// const handleChat = async (req, res) => {
//   try {
//     const { message, chatId, language = "en" } = req.body;
//     const userId = req.user._id;
//     const file = req.file; // from multer

//     if (!message && !file)
//       return res.status(400).json({ error: "Message or file is required." });

//     const userMessage = (message || "").trim() || "Please analyze this file.";

//     // Load or create session
//     let session;
//     if (chatId) {
//       session = await Chat.findOne({ _id: chatId, userId, isDeleted: false });
//       if (!session) return res.status(404).json({ error: "Chat not found." });
//     } else {
//       session = new Chat({ userId, title: generateTitle(userMessage), language, messages: [] });
//     }

//     // Build context (last 12 messages)
//     const history = session.messages.slice(-12).map((m) => ({
//       role: m.role,
//       content: m.content,
//     }));

//     // Build the user content — text + optional image/pdf
//     let userContent;
//     if (file) {
//       const isPDF = file.mimetype === "application/pdf";
//       const isImage = file.mimetype.startsWith("image/");

//       if (isImage) {
//         // Send image as base64 to vision model
//         const imageData = fs.readFileSync(file.path);
//         const base64 = imageData.toString("base64");
//         userContent = [
//           { type: "text", text: userMessage },
//           {
//             type: "image_url",
//             image_url: {
//               url: `data:${file.mimetype};base64,${base64}`,
//               detail: "high",
//             },
//           },
//         ];
//       } else if (isPDF) {
//         // For PDFs: tell the model about the file and ask it to help
//         // (OpenAI doesn't support PDF directly; we signal it in the text)
//         userContent = `[USER UPLOADED A PDF: "${file.originalname}"]\n\n${userMessage}\n\nNote: The user has uploaded a PDF document. Please ask clarifying questions about what they want to know about it, or if they have pasted text from it, analyze it.`;
//       }
//     } else {
//       userContent = userMessage;
//     }

//     history.push({ role: "user", content: userContent });

//     // SSE headers
//     res.setHeader("Content-Type", "text/event-stream");
//     res.setHeader("Cache-Control", "no-cache");
//     res.setHeader("Connection", "keep-alive");
//     res.setHeader("X-Accel-Buffering", "no");
//     res.flushHeaders();

//     let fullReply = "";

//     const stream = await openai.chat.completions.create({
//       model: "gpt-4o-mini",
//       messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
//       max_tokens: 700,
//       temperature: 0.5,
//       stream: true,
//     });

//     for await (const chunk of stream) {
//       const delta = chunk.choices[0]?.delta?.content || "";
//       if (delta) {
//         fullReply += delta;
//         res.write(`data: ${JSON.stringify({ token: delta })}\n\n`);
//       }
//     }

//     res.write(`data: ${JSON.stringify({ done: true, chatId: session._id, title: session.title })}\n\n`);
//     res.end();

//     // Cleanup uploaded file
//     if (file) {
//       fs.unlink(file.path, () => {});
//     }

//     // Save to DB
//     const attachmentInfo = file
//       ? { name: file.originalname, type: file.mimetype.startsWith("image/") ? "image" : "pdf", url: null }
//       : { name: null, type: null, url: null };

//     session.messages.push(
//       { role: "user", content: userMessage, attachment: attachmentInfo },
//       { role: "assistant", content: fullReply }
//     );
//     session.language = language;
//     session.save().catch((e) => console.error("DB save:", e.message));

//   } catch (err) {
//     console.error("Chat error:", err);
//     const msg = err.status === 429
//       ? "AI busy. Please wait." : err.status === 401
//       ? "AI config error." : "Something went wrong.";
//     if (res.headersSent) {
//       res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
//       res.end();
//     } else {
//       res.status(500).json({ error: msg });
//     }
//   }
// };

// // ─── GET /api/chat/sessions ────────────────────────────────────
// const getSessions = async (req, res) => {
//   try {
//     const sessions = await Chat.find({ userId: req.user._id, isDeleted: false })
//       .select("_id title language createdAt updatedAt messages")
//       .sort({ updatedAt: -1 })
//       .lean();

//     res.json({
//       sessions: sessions.map((s) => ({
//         id: s._id,
//         title: s.title,
//         language: s.language,
//         messageCount: s.messages.length,
//         preview: s.messages.length
//           ? s.messages[s.messages.length - 1].content.slice(0, 90) + "…"
//           : "",
//         updatedAt: s.updatedAt,
//         createdAt: s.createdAt,
//       })),
//     });
//   } catch (err) {
//     res.status(500).json({ error: "Failed to load history." });
//   }
// };

// // ─── GET /api/chat/sessions/:id ───────────────────────────────
// const getSessionMessages = async (req, res) => {
//   try {
//     const session = await Chat.findOne({
//       _id: req.params.chatId,
//       userId: req.user._id,
//       isDeleted: false,
//     });
//     if (!session) return res.status(404).json({ error: "Session not found." });
//     res.json({ chatId: session._id, title: session.title, language: session.language, messages: session.messages });
//   } catch (err) {
//     res.status(500).json({ error: "Failed to load messages." });
//   }
// };

// // ─── DELETE /api/chat/sessions/:id ────────────────────────────
// const deleteSession = async (req, res) => {
//   try {
//     const result = await Chat.findOneAndUpdate(
//       { _id: req.params.chatId, userId: req.user._id },
//       { isDeleted: true }
//     );
//     if (!result) return res.status(404).json({ error: "Chat not found." });
//     res.json({ message: "Deleted." });
//   } catch (err) {
//     res.status(500).json({ error: "Delete failed." });
//   }
// };

// module.exports = { handleChat, getSessions, getSessionMessages, deleteSession };




const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://openrouter.ai/api/v1", // 🔥 IMPORTANT
});

let isBusy = false;
// controllers/chatController.js

function cleanText(text) {
  return text.replace(/(dishonestly or fraudulently,?\s*)+/gi, 
    "dishonestly or fraudulently ");
}

const handleChat = async (req, res) => {
  if (isBusy) {
    return res.status(429).json({ error: "AI busy. Please wait." });
  }

  isBusy = true;

  try {
    const message = req.body.message;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // ✅ SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await client.chat.completions.create({
      model: "openrouter/auto", // 🔥 FREE model auto चयन
      messages: [
       {
  role: "system",
  content: `
You are LexBot, a professional Indian legal assistant.

- Always give clear, direct legal answers.
- DO NOT say "I cannot provide legal advice".
- Answer like a knowledgeable lawyer in simple language.
- Mention relevant laws (IPC, IT Act, etc.).
- Include punishment clearly.
- Keep answers structured and easy to understand.

Example style:
Section, Explanation, Punishment.

Do not add unnecessary warnings or disclaimers.
`
},
        {
          role: "user",
          content: message,
        },
      ],
      stream: true,
    });

    let fullText = "";

    for await (const chunk of stream) {
      const token = chunk.choices?.[0]?.delta?.content || "";
      if (token) {
        fullText += token;

        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    }

    res.write(
      `data: ${JSON.stringify({
        done: true,
        chatId: Date.now(),
        title: encodeURIComponent(message.slice(0, 30)),
      })}\n\n`
    );

    res.end();

  } catch (err) {
    console.error("FREE AI ERROR:", err);

    res.write(
      `data: ${JSON.stringify({
        error: "Free AI error. Try again.",
      })}\n\n`
    );

    res.end();
  } finally {
    isBusy = false;
  }
};

// Dummy session handlers (same as before)
const getSessions = async (req, res) => {
  res.json({ sessions: [] });
};

const getSessionMessages = async (req, res) => {
  res.json({ messages: [], title: "Chat", language: "en" });
};

const deleteSession = async (req, res) => {
  res.json({ success: true });
};

module.exports = {
  handleChat,
  getSessions,
  getSessionMessages,
  deleteSession,
};
