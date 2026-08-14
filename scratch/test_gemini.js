import axios from 'axios';

const GEMINI_API_KEY = "AIzaSyC7bM_4Fr_Z2DDFMhZPqCTnA7oQLrKBV2I";

async function testGemini() {
  const prompt = "Encuentra información sobre Atecmin Ltda. Necesito su sitio web oficial.";
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  console.log("Intentando conectar con Gemini...");
  
  try {
    const response = await axios.post(geminiUrl, {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ],
      tools: [
        {
          google_search: {}
        }
      ]
    });
    console.log("Éxito:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error("Error al conectar con Gemini:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

testGemini();
