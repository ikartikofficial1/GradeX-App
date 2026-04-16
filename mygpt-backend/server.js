require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();

// 🔥 FIX 1: Render Proxy Error (ValidationError) ko khatam karne ke liye
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

// Static Files Middleware
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

// 🔥 FIX 2: Bouncer (Rate Limiter) ko setup kiya
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 20, 
  message: {
    error: "Yaar lagta hai tumhari speed bullet train jaisi hai! 🚄 Mere server ke bouncer ne tumhe rok diya hai. Pls 1 minute wait karke dobara message bhej na.",
  },
  standardHeaders: true, // Recommended for Render
  legacyHeaders: false,
});

// API Route
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

    // 🔥 FIX 3: Confirmed Model Name from your list
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: friendlySystemPrompt }] },
        contents: formattedContents,
      }),
    });

    const data = await response.json();

    // Error Interceptor
    if (data.error) {
      console.error("Bhai API error aaya:", data.error.message);
      let finalReply = `Arre yaar ${userName}, main yahin hoon. Bas meri battery thodi down hai, 20 second baad try kar na! ⚡`;
      
      return res.json({
        candidates: [{ content: { parts: [{ text: finalReply }] } }],
      });
    }

    // 🔥 FIX 4: Response Handling (Thinking models ke liye special)
    // Hum sirf woh part bhejenge jisme AI ka reply hai
    if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
      // "thinking" models multiple parts bhej sakte hain, isliye sabko join kar rahe hain
      const aiText = data.candidates[0].content.parts.map(part => part.text).join("");
      
      // Frontend ko waisa hi format de rahe hain jaisa wo expect kar raha hai
      return res.json({
        candidates: [{
          content: {
            parts: [{ text: aiText }]
          }
        }]
      });
    }

    res.json(data);
  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ error: "Server mein kuch gadbad hai bhai!" });
  }
});

// Specific Routes
app.get("/share.html", (req, res) => {
  res.sendFile(path.join(__dirname, "share.html"));
});

// General Fallback (Sabse niche)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Bhai, tumhara server http://localhost:${PORT} par shuru ho gaya hai! 🚀`);
});