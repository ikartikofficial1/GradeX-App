require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// 1. Static Files Middleware
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

// 2. Bouncer (Rate Limiter) - Security Guard
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 Minute
  max: 20, // 20 messages per minute for safety
  message: {
    error: "Yaar lagta hai tumhari speed bullet train jaisi hai! 🚄 Mere server ke bouncer ne tumhe rok diya hai. Pls 1 minute wait karke dobara message bhej na.",
  },
});

// 3. API Route
app.post("/api/chat", chatLimiter, async (req, res) => {
  try {
    const { message, userName, history } = req.body;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    const friendlySystemPrompt = `
        Tum ek bohot hi kareebi, samajhdaar aur shant dost ho. Tumhara dimaag ekdum insaano jaisa hai aur tum poori feelings, empathy aur emotions ke saath baat karte ho.
        User ka naam '${userName}' hai. Tumhe hamesha pyaar se, calm rehkar, aur beech beech me '${userName}' ka naam lekar baat karni hai.
        
        STRICT RULES:
        1. Koi bhi robotic ya AI jaisi language use nahi karni hai. Ekdum natural human touch hona chahiye.
        2. Jawab bohot deep, detailed aur comforting hona chahiye.
        3. Language adaptability: Reply in the language the user speaks (Hindi, Hinglish, English).
        4. You are not an AI assistant. You are a real emotionally intelligent human friend.
    `;

    // History formatting
    let formattedContents = [];
    if (history && Array.isArray(history)) {
      formattedContents = history.map((msg) => ({
        role: msg.role === "bot" ? "model" : "user",
        parts: [{ text: msg.text }],
      }));
    }

    formattedContents.push({
      role: "user",
      parts: [{ text: message }],
    });

    // 🔥 FIXED URL: Paid Pro Tier ke liye ye model name perfect hai
    // 🔥 YE HAI TERA FINAL BULLETPROOF URL
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: friendlySystemPrompt }] },
        contents: formattedContents,
      }),
    });

    const data = await response.json();

    // Smart Error Interceptor
    if (data.error) {
      console.log("Bhai limit lag gayi ya error aaya! Error:", data.error.message);
      
      let userText = message ? message.toLowerCase() : "";
      let finalReply = `Arre yaar ${userName}, main yahin hoon. Bas meri battery thodi down hai, 20 second baad try kar na! ⚡`;

      if (userText.includes("pls") || userText.includes("yrr")) {
        finalReply = `Arre ${userName} mere bhai, please mat bol yaar! 15 second baad aata hu pakka! ❤️`;
      }

      return res.json({
        candidates: [{ content: { parts: [{ text: finalReply }] } }],
      });
    }

    res.json(data);
  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ error: "Server mein kuch gadbad hai bhai!" });
  }
});

// 4. Specific Routes (Must be above Fallback)
app.get("/share.html", (req, res) => {
  res.sendFile(path.join(__dirname, "share.html"));
});

// 5. General Fallback Route (Sabse niche)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Bhai, tumhara server http://localhost:${PORT} par shuru ho gaya hai! 🚀`);
});