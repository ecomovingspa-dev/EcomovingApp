import dotenv from 'dotenv';
import path from 'path';

console.log("Working Dir:", process.cwd());
const envPath = path.resolve(process.cwd(), '.env.local');
console.log("Env Path:", envPath);

const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error("Dotenv Error:", result.error);
} else {
  console.log("Dotenv parsed successfully!");
}

console.log("Keys in process.env:", Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('GEMINI') || k.includes('URL')));
