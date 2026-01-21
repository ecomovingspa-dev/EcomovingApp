
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { text, type, context } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        let prompt = '';

        if (type === 'asunto') {
            prompt = `Actúa como un experto en cobranzas y redacción persuasiva. Mejora el siguiente ASUNTO de correo para que sea claro, profesional y genere apertura, pero sin ser agresivo.
            Contexto: ${context || 'Cobranza general'}
            Texto original: "${text}"
            
            Solo devuelve el texto mejorado, sin comillas ni explicaciones.`;
        } else if (type === 'intro') {
            prompt = `Actúa como un experto en cobranzas y comunicación corporativa. Mejora el siguiente mensaje de INTRODUCCIÓN de un correo de cobranza. Debe ser cordial pero firme, recordando la deuda pendiente.
            Contexto: ${context || 'Cobranza amigable'}
            Texto original: "${text}"
            
            Solo devuelve el texto mejorado. Mantén los placeholders como {dias} si existen.`;
        } else if (type === 'cierre') {
            prompt = `Actúa como un experto en cobranzas. Mejora el siguiente mensaje de CIERRE de un correo. Debe invitar a la acción (pago) y mantener la relación comercial.
            Contexto: ${context || 'Cierre de correo'}
            Texto original: "${text}"
            
            Solo devuelve el texto mejorado. Mantén los placeholders si existen.`;
        } else {
            prompt = `Mejora el siguiente texto para que sea más profesional y claro: "${text}"`;
        }

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const improvedText = response.text().trim();

        return res.status(200).json({ improvedText });

    } catch (error: any) {
        console.error('Error generating content:', error);
        return res.status(500).json({ error: error.message || 'Error generating content' });
    }
}
