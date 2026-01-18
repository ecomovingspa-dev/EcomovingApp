/**
 * Servicio para interactuar con la API de Google Gemini (v1beta REST)
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_NAME = "gemini-2.0-flash";
const IMAGE_MODEL = "imagen-4.0-generate-001";

export interface GeneratedContent {
  subject: string;
  part1: string;
  part2: string;
  social: string;
  html: string;
  improvedImage?: string; // Base64 de la imagen generada
}

/**
 * Mejora la imagen del producto priorizando la BELLEZA del fondo y la FIDELIDAD del producto.
 * Utiliza un enfoque multimodal avanzado.
 */
export const improveProductImage = async (base64Image: string): Promise<string> => {
  if (!API_KEY) throw new Error("VITE_GEMINI_API_KEY no está configurada.");

  // Usamos el modelo más capaz de seguir instrucciones complejas y generar imágenes bellas en v1beta
  const MODEL_GEN = "gemini-2.0-flash-exp-image-generation";
  const base64Data = base64Image.split(',')[1] || base64Image;

  // Prompt equilibrado entre "Belleza" y "No tocar el producto"
  const prompt = `Task: Professional Background Replacement.
Product provided: [IMAGE]

INSTRUCTIONS FOR THE AI:
1. OVERALL BEAUTY: Create a stunning, high-end commercial photo. The final result should look like it was shot in a professional lighting studio with a luxury lifestyle aesthetic.
2. PRESERVE THE PRODUCT: The backpack/product in the image must remain EXACTLY as it is in the original. Do not retouch the fabric, do not change the texture, and DO NOT alter the logos. The logos must be clear and identical.
3. BACKGROUND TRANSFORMATION: Replace the current background with a beautiful, modern, and clean professional setting. Examples: A soft-textured stone surface, a high-end minimalist wooden table, or a neutral studio gradient with cinematic bokeh.
4. LIGHTING & COLOR: Enhance the LIGHTING of the scene to be cinematic and professional, but ensure the COLORS of the product remain true to the original.
5. QUALITY: 2K resolution, photorealistic, premium feel.

RESPONSE FORMAT: You MUST return a generated image.`;

  const response = await fetch(`${BASE_URL}/${MODEL_GEN}:generateContent?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/jpeg", data: base64Data } }
        ]
      }],
      generationConfig: {
        responseModalities: ["IMAGE"]
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Error al conectar con la IA de mejora");
  }

  const result = await response.json();

  // Extraer la imagen de la respuesta multimodal
  const generatedBase64 = result.candidates?.[0]?.content?.parts?.find((p: any) => p.inline_data)?.inline_data?.data;

  if (!generatedBase64) {
    // Si no hay imagen, buscamos el motivo en el texto para ayudar al usuario
    const textReason = result.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;

    if (textReason && textReason.toLowerCase().includes("logos") || textReason.toLowerCase().includes("policy")) {
      throw new Error("La IA ha detectado logos protegidos o restricciones de fidelidad y no ha podido generar la imagen para evitar alterarlos. Intenta con una toma más cercana o fondo más simple.");
    }

    throw new Error(textReason || "El modelo no pudo generar la imagen con el estándar de belleza y fidelidad solicitado. Por favor, intenta de nuevo.");
  }

  return `data:image/png;base64,${generatedBase64}`;
};

/**
 * Genera contenido de marketing basado en una imagen (base64)
 */
export const generateMarketingContent = async (
  base64Image: string,
  prompt: string = ""
): Promise<GeneratedContent> => {
  if (!API_KEY) throw new Error("VITE_GEMINI_API_KEY no está configurada.");

  const defaultPrompt = `Analiza el producto en la imagen y genera copia de marketing profesional en ESPAÑOL.
Formatea tu respuesta exactamente de esta manera (sin usar Markdown ni asteriscos en las etiquetas):
SUBJECT: [Asunto llamativo]
PART1: [Párrafo introductorio sobre calidad y exclusividad]
PART2: [Llamado a la acción y cierre]
SOCIAL: [Caption para redes sociales con emojis]

Reglas:
- Tono profesional y elegante.
- Enfócate en los beneficios de estilo de vida.
- No menciones especificaciones técnicas a menos que sean visibles.`;

  const finalPrompt = prompt || defaultPrompt;

  // Limpiar el prefijo data:image/...;base64,
  const base64Data = base64Image.split(',')[1] || base64Image;

  const response = await fetch(`${BASE_URL}/${MODEL_NAME}:generateContent?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: finalPrompt },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Error al llamar a Gemini API");
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Parsear la respuesta estructurada
  const subjectMatch = text.match(/SUBJECT:\s*(.*)/i);
  const part1Match = text.match(/PART1:\s*([\s\S]*?)(?=PART2:|SOCIAL:|$)/i);
  const part2Match = text.match(/PART2:\s*([\s\S]*?)(?=SOCIAL:|$)/i);
  const socialMatch = text.match(/SOCIAL:\s*([\s\S]*)$/i);

  const subject = subjectMatch ? subjectMatch[1].trim() : "Exclusividad Ecomoving";
  const p1 = part1Match ? part1Match[1].trim() : "";
  const p2 = part2Match ? part2Match[1].trim() : "";
  const sc = socialMatch ? socialMatch[1].trim() : "";

  // Generar HTML profesional estilo Brevo para el email
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    .email-container { max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background-color: #ffffff; }
    .content-padding { padding: 40px 20px; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6;">
  <div class="email-container">
    <div class="content-padding">
      <h1 style="color: #111827; font-size: 24px; font-weight: bold; margin-bottom: 24px; text-align: center;">${subject}</h1>
      
      <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 30px;">
        ${p1}
      </p>

      <div style="text-align: center; margin-bottom: 30px;">
        <img src="IMAGE_PLACEHOLDER" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);" alt="${subject}" />
      </div>

      <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 32px;">
        ${p2}
      </p>

      <div style="text-align: center;">
        <a href="#" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
          Ver Catálogo Completo
        </a>
      </div>
    </div>
    
    <div class="footer">
      <p style="margin: 0 0 8px 0;"><strong>Ecomoving SpA</strong></p>
      <p style="margin: 0 0 16px 0;">Regalos Corporativos con Impacto Sustentable</p>
      <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 16px;">
        <p style="margin: 0;">Recibiste este correo porque estás en nuestra lista de contactos preferenciales.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  return {
    subject,
    part1: p1,
    part2: p2,
    social: sc,
    html
  };
};
