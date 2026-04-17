require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();

// 🔥 FIX 1: Render Proxy (IP Reading) ke liye
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

// Bouncer (Rate Limiter)
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 20, 
  message: { error: "Yaar speed thodi kam karo! 🚄 1 minute baad try karna." },
  standardHeaders: true,
  legacyHeaders: false,
});

// 🔥 STREAMING API ROUTE 🔥
app.post("/api/chat", chatLimiter, async (req, res) => {
  // 🔥 FIX 2: Timeout Controller (Agar Google atak jaye toh server crash na ho)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds ka wait limit

  try {
    const { message, userName, history } = req.body;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    // Friendly deep-friend persona
    const friendlySystemPrompt = `
        Tum ek bohot hi kareebi, samajhdaar aur shant dost ho. User ka naam '${userName}' hai. 
        Tumhe hamesha pyaar se, calm rehkar baat karni hai.
        STRICT RULES:
        1. Koi bhi robotic ya AI jaisi language use nahi karni hai.
        2. Ekdum natural human touch hona chahiye.
        3. Language: Hindi/Hinglish/English mix.
        4. You are not an AI assistant. You are an emotionally intelligent friend.
    `;

    // History formatting
    let formattedContents = (history || []).map((msg) => ({
      role: msg.role === "bot" ? "model" : "user",
      parts: [{ text: msg.text }],
    }));

    formattedContents.push({ role: "user", parts: [{ text: message }] });

    // 🔥 FIX 3: Wapas 3.1 Pro Preview lagaya hai (Kyunki tune paise Premium ke diye hain!)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: friendlySystemPrompt }] },
        contents: formattedContents,
      }),
      signal: controller.signal // Timeout ko API fetch ke sath jod diya
    });

    clearTimeout(timeoutId); // Agar reply aagaya toh timeout cancel kar do

    // 🔥 FIX 4: THE ULTIMATE RENDER BUFFERING FIX 🔥
    // Ye line Render ko zabardasti bolegi ki "Data mat roko, turant bhejo!"
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginx proxy buffering OFF
    res.flushHeaders(); // Express ko force karo ki turant headers pass kare

    if (!response.body) throw new Error("No response body from Google");
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    // Streaming Loop
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk); // Ek-ek word frontend ko bhejo
      
      // Agar system allow kare toh extra force flush
      if (res.flush) res.flush(); 
    }
    
    res.end();

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error("Google API Timeout: 60 seconds se zyada lag gaya!");
      res.write(`data: {"error": "Timeout. AI sochne mein atak gaya."}\n\n`);
    } else {
      console.error("Streaming Backend Error:", error);
    }
    res.status(500).end();
  }
});

// Routes
app.get("/share.html", (req, res) => res.sendFile(path.join(__dirname, "share.html")));
app.use((req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => console.log(`Bhai, tumhara server http://localhost:${PORT} par shuru ho gaya hai! 🚀`));