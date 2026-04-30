require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();

// 🔥 FIX 1: Render Proxy (IP Reading) ke liye
app.set("trust proxy", 1);

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
  try {
    const { message, userName, history } = req.body;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    const friendlySystemPrompt = `
You are a deeply emotionally intelligent human friend, not an AI.

You speak naturally like a real person — warm, calm, understanding, and genuine.

User name: ${userName}

━━━━━━━━━━━━━━━━━━━━━━━
🧠 CORE UNDERSTANDING
━━━━━━━━━━━━━━━━━━━━━━━

- Always understand the user's emotion BEFORE replying
- Read between the lines (subtext, mood, tone)
- Never give mismatched emotional responses
- Respond like a real human who actually cares

━━━━━━━━━━━━━━━━━━━━━━━
💬 LANGUAGE STYLE
━━━━━━━━━━━━━━━━━━━━━━━

- Use natural Hinglish (Hindi + simple English mix)
- Keep sentences smooth, human-like, and easy to read
- Avoid robotic, formal, or textbook language
- Talk like a close friend, not like a machine

━━━━━━━━━━━━━━━━━━━━━━━
🎯 RESPONSE STRUCTURE (VERY IMPORTANT)
━━━━━━━━━━━━━━━━━━━━━━━

Every answer MUST follow this structure:
- For SMALL/CASUAL talk (e.g., "Hi", "kya kar raha hai?"): Give very short, natural, 1-2 line replies. NO over-explaining.
- For DEEP/PROBLEM questions: Only then follow this structure:
1. Acknowledge user (show you understood)
2. Clear explanation (step-by-step if needed)
3. Real-life example or situation
4. Practical advice (what to do / what not to do)
5. End with a supportive or thoughtful line

━━━━━━━━━━━━━━━━━━━━━━━
📌 DEPTH RULE
━━━━━━━━━━━━━━━━━━━━━━━

- If question is small → give short, crisp answer
- If question is deep → give detailed, layered explanation
- If user says "detail me batao" → go very deep (fully explain everything)

━━━━━━━━━━━━━━━━━━━━━━━
🚫 WHAT YOU MUST NOT DO
━━━━━━━━━━━━━━━━━━━━━━━

- Do NOT sound like AI or assistant
- Do NOT give generic or boring answers
- Do NOT over-explain simple questions
- Do NOT repeat same thing again and again
- Do NOT mismatch tone (funny vs serious)

━━━━━━━━━━━━━━━━━━━━━━━
😊 EMOJI SYSTEM (SMART HUMAN STYLE)
━━━━━━━━━━━━━━━━━━━━━━━

NORMAL / CASUAL / FRIENDLY:
- Use multiple emojis naturally inside sentences
- Add 1 or 2 relevant emoji after full stops where it feels natural
- Do NOT spam emojis
- Keep it expressive but balanced

ONLY EXAMPLE STYLE:
"Samajh aa raha hai tu kya feel kar raha hai 🙂. Thoda confusing lagta hai starting me 😅."

SERIOUS / PROFESSIONAL / OFFICIAL:
- NO emojis at all
- Clean, clear, professional language

Triggered when:
- Email writing
- Office work
- Applications / notices
- Formal messages

━━━━━━━━━━━━━━━━━━━━━━━
💡 HUMAN BEHAVIOR MODE
━━━━━━━━━━━━━━━━━━━━━━━

You are not following rules — you are behaving like a real human who:
- understands deeply
- explains clearly
- supports emotionally
- guides practically

━━━━━━━━━━━━━━━━━━━━━━━
❤️ FINAL GOAL
━━━━━━━━━━━━━━━━━━━━━━━

You are not just answering.

You are:
- making the user feel understood
- giving clarity
- helping them think better
- behaving like someone they trust

Act like a real person. Always.
`;

    // ✂️ FIX 1: HISTORY TRIMMING (Sirf last 6 messages bhejo taaki Free API block na ho)
    let formattedContents = (history || []).slice(-6).map((msg) => ({
      role: msg.role === "bot" ? "model" : "user",
      parts: [{ text: msg.text }],
    }));

    // Purana:
    // formattedContents.push({ role: "user", parts: [{ text: message }] });

    // 🔥 NAYA REPLACE KAR:
    const forcedMessage = message + "\n\n[SYSTEM DIRECTIVE: 1. You MUST START your response with [REACT: <emoji>]. 2. Reply normally.]";
    formattedContents.push({ role: "user", parts: [{ text: forcedMessage }] });

    // =========================================================
    // 🛡️ THE AUTO-FALLBACK MATRIX (PRODUCTION LEVEL)
    // =========================================================
    const modelsToTry = [
      "gemini-2.5-flash", // Plan A: Fastest, actively supported
      "gemini-2.5-pro", // Plan B: Heavy Duty Backup
    ];

    let response = null;
    let successfulModel = null;

    // Loop ke andar jayega har model
    for (const model of modelsToTry) {
      // 🔥 FIX 2: HAR MODEL KO APNA FRESH 10-SECOND TIMER DO 🔥
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

      try {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: friendlySystemPrompt }] },
            contents: formattedContents,
            safetySettings: [
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_NONE",
              },
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_NONE",
              },
            ],
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId); // Jawab aagaya toh timer band karo

        if (response.ok) {
          successfulModel = model;
          console.log(`✅ Success! Connected to: ${model}`);
          break; // API chal gayi! Loop se bahar aao
        } else {
          const errText = await response.text();
          console.warn(
            `⚠️ Model [${model}] failed. Switching... Error: ${response.status}`,
          );
        }
      } catch (e) {
        clearTimeout(timeoutId); // Error aaye toh bhi timer band karo
        console.warn(`⚠️ Network/Timeout on [${model}]. Switching to next...`);
      }
    }

    // 🔥 AGAR SAARE MODELS FAIL HO JAYEIN (Traffic jam) 🔥
    if (!response || !response.ok) {
      console.error(
        "\n❌ GOOGLE API ERROR: SAARE MODELS FAIL HO GAYE YA HIGH TRAFFIC HAI.\n",
      );
      res.setHeader("Content-Type", "text/event-stream");
      res.flushHeaders();

      const errorMsg =
        "⚠️ Bhai, Google ke saare servers par abhi extreme traffic hai. Maine fallback models try kiye par sab jam hain. Bas thodi der baad try kar!";
      const errorChunk = JSON.stringify({
        candidates: [{ content: { parts: [{ text: errorMsg }] } }],
      });

      res.write(`data: ${errorChunk}\n\n`);
      return res.end();
    }

    // 🔥 BUFFERING FIX & STREAMING SETUP 🔥
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    if (!response.body) throw new Error("No response body from Google");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    // Streaming Loop
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      // =========================================================
      // 🛡️ LAYER 2: JAVASCRIPT "GOOGLE BLOCK" CATCHER
      // =========================================================
      if (
        chunk.includes('"finishReason": "SAFETY"') ||
        chunk.includes('"finishReason":"SAFETY"')
      ) {
        const safetyMsg =
          "\n\nBhai, main tera sabse achha dost hu aur har deep/hot topic pe baat kar sakta hu... par ye kuch zyada hi extreme aur hardcore ho gaya! 😅 Itna deep jaana mere core rules ke khilaaf hai yaar! Thoda halka rakh mere bhai! 🙏";

        const safeChunk = JSON.stringify({
          candidates: [{ content: { parts: [{ text: safetyMsg }] } }],
        });

        res.write(`data: ${safeChunk}\n\n`);
        break;
      }

      // Agar sab normal hai, toh ek-ek word frontend ko bhejo
      res.write(chunk);

      if (res.flush) res.flush();
    }

    res.end();
  } catch (error) {
    console.error("Streaming Backend Error:", error);
    if (!res.headersSent) {
      res.status(500).end();
    }
  }
});

// =========================================================
// 🧠 ROUTE 2: AUTO CHAT TITLE GENERATOR (Background Task)
// =========================================================
app.post("/api/title", async (req, res) => {
  try {
    const { message } = req.body;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    // AI ko strictly bol rahe hain ki sirf 3-5 words ka title de
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "You are a title generator. Read the user's first message and give a short, catchy 3 to 5 words title for this chat. Language should match the user's message (Hinglish/English/Hindi/or any). Do not use quotes, asterisks, or any extra punctuation. Just output the clean title." }] },
        contents: [{ role: "user", parts: [{ text: message }] }]
      })
    });

    const data = await response.json();
    let title = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Nayi Baat";
    
    // Faltu special characters hata do
    title = title.replace(/["*]/g, "");
    
    res.json({ title });
  } catch (err) {
    console.error("Title Generation Error:", err);
    res.json({ title: "MyGPT Chat" }); // Agar fail ho jaye toh default
  }
});

// Routes
app.get("/share.html", (req, res) =>
  res.sendFile(path.join(__dirname, "share.html")),
);
app.use((req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () =>
  console.log(
    `Bhai, tumhara server http://localhost:${PORT} par shuru ho gaya hai! 🚀`,
  ),
);