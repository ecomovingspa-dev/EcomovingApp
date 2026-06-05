import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || "AIzaSyANy1lc4pJU0YhaS_fL1N2JNfHJHK2F15E";

async function listModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
  try {
    const res = await axios.get(url);
    console.log("SUCCESS! Available models:");
    const models = res.data?.models || [];
    models.forEach((m: any) => {
      console.log(` - ${m.name} | Methods: ${m.supportedGenerationMethods}`);
    });
  } catch (err: any) {
    console.error("Error listing models:", err.response?.status, err.response?.data);
  }
}

listModels();
