import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || "AIzaSyANy1lc4pJU0YhaS_fL1N2JNfHJHK2F15E";

async function testGemini() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  console.log("Testing WITH google_search...");
  try {
    const res = await axios.post(url, {
      contents: [{ parts: [{ text: "Busca la web de Bridon Bekaert Chile y dime su URL." }] }],
      tools: [{ google_search: {} }]
    });
    console.log("Success with search:", res.data);
  } catch (err: any) {
    console.error("Error with search:", err.response?.status, err.response?.data);
  }

  console.log("\nTesting WITHOUT google_search...");
  try {
    const res = await axios.post(url, {
      contents: [{ parts: [{ text: "Dime qué es Bridon Bekaert Chile." }] }]
    });
    console.log("Success without search:", res.data?.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch (err: any) {
    console.error("Error without search:", err.response?.status, err.response?.data);
  }
}

testGemini();
