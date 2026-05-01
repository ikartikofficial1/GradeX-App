require("dotenv").config();

async function checkValidModels() {
    console.log("🔍 Google ke servers se live models nikaal raha hu...\n");
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        console.log("🔥 TERE ACCOUNT KE LIYE 100% VALID MODELS 🔥\n");
        
        data.models.forEach(m => {
            // Sirf wo model dikhao jo text generate kar sakte hain
            if (m.name.includes("gemini") && m.supportedGenerationMethods.includes("generateContent")) {
                console.log(`👉 "${m.name.replace('models/', '')}"`);
            }
        });
        console.log("\n✅ Inme se koi bhi naam copy kar aur server.js me daal de!");
    } catch (err) {
        console.error("❌ Error:", err);
    }
}

checkValidModels();