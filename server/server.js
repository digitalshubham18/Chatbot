const express = require("express");
const cors = require("cors");
require("dotenv").config();
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());
const otpRoutes = require("./otpRoutes");
app.use("/api/auth", otpRoutes);
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
console.log("KEY CHECK:", process.env.OPENROUTER_API_KEY);
    console.log("OPENROUTER KEY:", process.env.OPENROUTER_API_KEY); // debug
const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
  // "Authorization": "Bearer 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",
  "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
  "Content-Type": "application/json",
  "HTTP-Referer": "http://localhost",
  "X-Title": "Legal AI Assistant"
},
  body: JSON.stringify({
    model: "openai/gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You are a legal assistant. Explain clearly with bullet points."
      },
      {
        role: "user",
        content: message
      }
    ]
  })
});

    const data = await response.json();

    console.log("OPENROUTER RESPONSE:", data);

    if (data.error) {
      return res.json({
        reply: "⚠️ " + data.error.message
      });
    }

    const reply =
      data.choices?.[0]?.message?.content ||
      "⚠️ No response from AI";

    res.json({ reply });

  } catch (error) {
    console.error("SERVER ERROR:", error);
    res.json({
      reply: "⚠️ Server error: " + error.message
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});