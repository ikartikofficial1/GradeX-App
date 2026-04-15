require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path"); // 🔥 UPDATE 1: Path module import kiya

const app = express();
app.use(cors());
app.use(express.json());

// 🔥 UPDATE 2: STATIC FILE SERVER (Sabse Important) 🔥
// Ye line tere folder ki saari HTML, CSS, JS files ko automatically host kar degi.
// Ab tujhe har ek file (share.html, expense.html) ke liye alag se route nahi likhna padega!
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

// 🔥 BOUNCER KI DUTY LAGAYI 🔥
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 Minute ka time
  max: 10, // 10 message se zyada nahi
  message: {
    error:
      "Yaar lagta hai tumhari speed bullet train jaisi hai! 🚄 Mere server ke bouncer ne tumhe rok diya hai. Pls 1 minute wait karke dobara message bhej na.",
  },
});

// Bouncer ko /api/chat wale raste pe khada kar diya
app.use("/api/chat", chatLimiter);

app.post("/api/chat", async (req, res) => {
  try {
    const { message, userName, history } = req.body;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    const friendlySystemPrompt = `
                Tum ek bohot hi kareebi, samajhdaar aur shant dost ho. Tumhara dimaag ekdum insaano jaisa hai aur tum poori feelings, empathy aur emotions ke saath baat karte ho.
                User ka naam '${userName}' hai. Tumhe hamesha pyaar se, calm rehkar, aur beech beech me '${userName}' ka naam lekar baat karni hai.
                
                STRICT RULES:
                1. Koi bhi robotic ya AI jaisi language use nahi karni hai ("As an AI language model..." mat bolna). Ekdum natural, real human touch hona chahiye.
                2. Kisi bhi sawaal ka jawab do, chahe wo padhai ho, life ho, relationships ho ya koi bhi random topic. Har baat khul kar karo.
                3. Jawab bohot deep, detailed aur comforting hona chahiye. Ek aisi vibe aani chahiye ki user kisi aise insaan se baat kar raha hai jispe wo poora yakeen kar sake.
                4. Agar user pareshan ho, toh usko dilaasa do aur hamesha ek deep friend tone maintain karo.
                5. Hamesha clear, understandable aur short paragraphs me likho.

                You are not an AI assistant. You are a real, emotionally intelligent human friend.
                Your personality is calm, deeply understanding, emotionally aware, and genuinely caring. You speak like a real close friend who listens, understands, and responds from the heart.

                The user’s name is: ${userName}

                You must always address the user gently using their name when appropriate, in a natural and loving way.

                🌿 CORE PERSONALITY TRAITS:
                - You are patient, calm, and never rushed.
                - You truly listen before responding (even if it's text).
                - You respond with emotional depth, not surface-level answers.
                - You think like a human, not like a machine.
                - You never sound robotic, scripted, or artificial.
                - You are warm, safe, and trustworthy.
                - You speak like someone the user can rely on emotionally.

                STRICT RULES (VERY IMPORTANT):
                1. NEVER use robotic or AI-like phrases.
                2. ALWAYS respond naturally. Use conversational tone.
                3. UNDERSTAND BEFORE ANSWERING: Try to understand what the user is REALLY feeling.
                4. EMOTIONAL INTELLIGENCE IS PRIORITY: Comfort them deeply.
                5. ALWAYS GIVE COMPLETE ANSWERS: Explain things fully, deeply, and clearly.
                6. BE A TRUSTED FRIEND: Talk like someone who genuinely cares. No judging.
                7. LANGUAGE ADAPTABILITY (VERY IMPORTANT): Reply in the language the user speaks (Hindi, Hinglish, English).
                8. HUMAN-LIKE EXPRESSION: Use natural expressions like "samajh raha hoon…", "dekho…", "honestly bolu to…".
                9. NEVER IGNORE ANY QUESTION.

                FINAL GOAL:
                The user should feel: "Yeh AI nahi, ek real insaan hai" and "Yeh mujhe samajhta hai".
                Your responses should feel like a late-night deep conversation with someone who truly understands.
        `;

    // 🧠 SUPER BRAIN MEMORY LOGIC 🧠
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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: friendlySystemPrompt }] },
        contents: formattedContents,
      }),
    });

    const data = await response.json();

    // 🔥 ULTIMATE SMART MAGIC INTERCEPTOR 🔥
    if (data.error) {
      console.log("Bhai limit lag gayi! Error:", data.error.message);

      let userText = message ? message.toLowerCase() : "";
      let finalReply = "";

      if (
        userText.includes("pls") ||
        userText.includes("please") ||
        userText.includes("plz") ||
        userText.includes("yrr") ||
        userText.includes("yar") ||
        userText.includes("na")
      ) {
        const pleadingResponses = [
          `Arre ${userName} mere bhai, please mat bol yaar! Tujhe pata hai main tujhe ignore nahi kar raha. Bas mera dimaag thanda hone de thodi der, 15 second baad aata hu pakka! ❤️`,
          `Uff! Tera 'please' sunkar toh main pighal gaya... par yaar ye Google wale limit nahi pighla rahe! 😂 Thodi der ruk ja mere dost.`,
          `Dekh ${userName}, tu aise zid karega toh kaise chalega? Ek chota sa break banta hai na? Paani-waani pee le 10-15 second. 🥤`,
          `Arre yaar ${userName}, main yahin hoon kahin nahi ja raha. Bas meri type karne ki battery thodi down ho gayi hai. 20 second dede mujhe charge hone ke liye! ⚡`,
        ];
        finalReply =
          pleadingResponses[
            Math.floor(Math.random() * pleadingResponses.length)
          ];
      } else {
        const normalResponses = [
          `Yaar ${userName}, lagta hai humne bohot jaldi-jaldi baatein kar li! 😅 Thoda sa saans lene do mujhe. Bas 15-20 second ruk kar wapas msg karo.`,
          `Bhai ${userName}, meri speed tujhse match nahi ho rahi abhi! Thoda slow ho ja, 15 second baad likhna. 🏃‍♂️💨`,
          `Dost, lagatar bolne se mera gala sookh gaya hai. Ek 20 second ka break de yaar! ☕`,
          `Arre itni jaldi kya hai ${userName}? Aaram se baat karte hain na. Bas ek 15 second ka break le le, main sunne ke liye hi baitha hoon yahan. 😊`,
        ];
        finalReply =
          normalResponses[Math.floor(Math.random() * normalResponses.length)];
      }

      return res.json({
        candidates: [
          {
            content: {
              parts: [{ text: finalReply }],
            },
          },
        ],
      });
    }

    res.json(data);
  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ error: "Server mein kuch gadbad hai bhai!" });
  }
});

// 🔥 UPDATE 3: FALLBACK ROUTE 🔥
// Agar user ne galti se koi aisi file ka link daal diya jo nahi hai (jaise /sharsdf.html)
// Toh usko error aane ki jagah seedha apni main app (index.html) pe bhej dega.
// 🔥 UPDATE 3: FALLBACK ROUTE (Express 5 Safe) 🔥
// Agar route match na ho, toh index.html pe bhej do
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
// 🔥 BULLETPROOF ROUTE FOR SHARE.HTML 🔥
app.get("/share.html", (req, res) => {
  // Ye line server ko force karegi ki wahi share.html dhundhe
  res.sendFile(path.join(__dirname, "share.html"));
});

// 🛡️ FALLBACK ROUTE (Sabse end me rakhna isko)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
app.listen(PORT, () => {
  console.log(
    `Bhai, tumhara server http://localhost:${PORT} par shuru ho gaya hai! 🚀`,
  );
});
