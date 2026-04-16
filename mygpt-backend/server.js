require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();

// Fix for Render Proxy
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 20, 
  message: { error: "Yaar speed thodi kam karo! 🚄 1 minute baad try karna." },
  standardHeaders: true,
  legacyHeaders: false,
});

// 🔥 STREAMING API ROUTE 🔥
app.post("/api/chat", chatLimiter, async (req, res) => {
  try {
    const { message, userName, history } = req.body;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    const friendlySystemPrompt = `
        Tum ek bohot hi kareebi dost ho. User ka naam '${userName}' hai. 
        Empathy ke saath baat karo. Natural human touch hona chahiye.
        Language: Hindi/Hinglish/English.
    `;

    let formattedContents = (history || []).map((msg) => ({
      role: msg.role === "bot" ? "model" : "user",
      parts: [{ text: msg.text }],
    }));

    formattedContents.push({ role: "user", parts: [{ text: message }] });

    // 🚀 STREAMING URL: streamGenerateContent use kar rahe hain
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: friendlySystemPrompt }] },
        contents: formattedContents,
      }),
    });

    // SSE (Server-Sent Events) Headers set kar rahe hain
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Google se aane wale data chunks ko direct client ko pipe (pass) kar rahe hain
    if (!response.body) throw new Error("No response body from Google");
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk); // Ek-ek word frontend ko ja raha hai
    }
    
    res.end();

  } catch (error) {
    console.error("Streaming Backend Error:", error);
    res.status(500).end();
  }
});

app.get("/share.html", (req, res) => res.sendFile(path.join(__dirname, "share.html")));
app.use((req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => console.log(`Server live on port ${PORT} 🚀`));