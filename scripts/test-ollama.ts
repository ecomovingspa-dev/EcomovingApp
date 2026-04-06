import { callOllama } from '../api/utils/ollama';

async function testOllama() {
    console.log("🚀 Probando conexión con Ollama...");
    try {
        const response = await callOllama("Di 'Hola, soy Gemma' en una frase corta.", "gemma2");
        console.log("✅ Respuesta de Ollama:", response);
    } catch (error: any) {
        console.error("❌ Error de conexión:", error.message);
        console.log("\n💡 Asegúrate de:");
        console.log("1. Tener Ollama instalado y corriendo (ollama serve)");
        console.log("2. Haber descargado el modelo: 'ollama pull gemma2'");
    }
}

testOllama();
