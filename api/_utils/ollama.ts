import axios from 'axios';

/**
 * Utility to interact with a local or remote Ollama instance.
 */
export async function callOllama(prompt: string, modelOverride?: string): Promise<string> {
    const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";
    const OLLAMA_MODEL = modelOverride || process.env.OLLAMA_MODEL || "gemma3:27b";
    
    try {
        const response = await axios.post(OLLAMA_URL, {
            model: OLLAMA_MODEL,
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.7,
                num_predict: 512
            }
        }, {
            timeout: 30000 // 30 seconds
        });

        return response.data.response || "";
    } catch (error: any) {
        console.error("Error calling Ollama:", error.message);
        throw new Error(`Ollama Error: ${error.message}`);
    }
}

/**
 * Specialized function for Prospección (Cold Outreach)
 */
export async function generateProspeccionIceBreaker(company: string, domain: string, baseIntro: string): Promise<string> {
    const prompt = `
Eres un experto en Ventas B2B para Ecomoving SpA (Chile), especialistas en merchandising corporativo sustentable.
Necesito que mejores este "Ice-Breaker" para un correo en frío dirigido a la empresa "${company}" (dominio: ${domain}).

ICE-BREAKER ORIGINAL:
"${baseIntro}"

TAREA:
1. Mantén la esencia: Estamos buscando al encargado de Compras o Sustentabilidad.
2. Personaliza: Usa el nombre de la empresa de forma natural.
3. Hazlo irresistible: Que no parezca un bot. Sé profesional, breve y cálido.
4. Usa español de Chile (profesional, sin modismos excesivos).

RESPONDE SOLO CON EL TEXTO DEL ICE-BREAKER MEJORADO, SIN COMENTARIOS ADICIONALES.
`;

    return callOllama(prompt);
}
