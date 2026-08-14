const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;

async function run() {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
    const response = await axios.get(url);
    console.log("Available models:");
    response.data.models.forEach(m => {
      console.log(` - Name: ${m.name} | Supported methods: ${m.supportedGenerationMethods.join(", ")}`);
    });
  } catch (e) {
    console.error("Error listing models:", e.message);
  }
}

run();
