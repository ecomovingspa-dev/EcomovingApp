/**
 * Servicio para interactuar con la API de Google Gemini (v1beta REST)
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_NAME = "gemini-2.0-flash-exp";
const IMAGE_MODEL = "imagen-3.0-generate-001";

export interface GeneratedContent {
    subject: string;
    part1: string;
    part2: string;
    social: string;
    html: string;
    improvedImage?: string; // Base64 de la imagen generada
}

/**
 * Mejora la imagen del producto usando Imagen 3 y el prompt profesional
 */
export const improveProductImage = async (base64Image: string): Promise<string> => {
    if (!API_KEY) throw new Error("VITE_GEMINI_API_KEY no está configurada.");

    // 1. Primero, le pedimos a Gemini que describa el producto con precisión quirúrgica
    const analysisResponse = await fetch(`${BASE_URL}/${MODEL_NAME}:generateContent?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: "Describe este producto de forma técnica y visual muy detallada para un generador de imágenes. Enfócate en su forma, color, textura y logotipos." },
                    { inline_data: { mime_type: "image/jpeg", data: base64Image.split(',')[1] || base64Image } }
                ]
            }]
        })
    });

    const analysisResult = await analysisResponse.json();
    const productDescription = analysisResult.candidates?.[0]?.content?.parts?.[0]?.text || "un producto exclusivo";

    // 2. Usamos el prompt profesional del usuario combinado con la descripción
    const userPrompt = `Professional commercial lifestyle photography of the product described below. The product must maintain its original shape, texture, and branding logo with high fidelity. Place it in a clean, aesthetically pleasing, and subtly blurred background that complements the product's purpose. Lighting: Studio quality, soft shadows, cinematic highlights. High resolution, 8k, exquisite detail. PRODUCT DESCRIPTION: ${productDescription}`;

    const imageResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:predict?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            instances: [{ prompt: userPrompt }],
            parameters: {
                sampleCount: 1,
                aspectRatio: "1:1"
            }
        })
    });

    if (!imageResponse.ok) {
        const error = await imageResponse.json();
        throw new Error(error.error?.message || "Error al mejorar la imagen con Imagen 3");
    }

    const imageResult = await imageResponse.json();
    const generatedBase64 = imageResult.predictions?.[0]?.bytesBase64Encoded;

    if (!generatedBase64) throw new Error("No se pudo generar la imagen.");

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

    // Generar HTML base para el email
    const html = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
      <p style="font-size: 16px; line-height: 1.6;">${p1}</p>
      <div style="margin: 30px 0; text-align: center;">
        <img src="IMAGE_PLACEHOLDER" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" alt="Producto" />
      </div>
      <p style="font-size: 16px; line-height: 1.6;">${p2}</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="font-size: 12px; color: #666; text-align: center;">Ecomoving - Regalos Corporativos Sustentables</p>
    </div>
  `.trim();

    return {
        subject,
        part1: p1,
        part2: p2,
        social: sc,
        html
    };
};
