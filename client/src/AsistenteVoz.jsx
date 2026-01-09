import React, { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "./supabase";

export const AsistenteVoz = () => {
  const [estado, setEstado] = useState("idle");
  const [mensaje, setMensaje] = useState("");

  // Tu API KEY
  const API_KEY =
    import.meta.env.VITE_GEMINI_API_KEY ||
    "AIzaSyBWg5r7kd6GpTCZzxEVeaeYljly23lHdIM";

  const procesarOrden = async (textoUsuario) => {
    setEstado("pensando");
    setMensaje("Interpretando datos del abono...");

    try {
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const hoy = new Date().toISOString().split("T")[0];

      // --- PROMPT AJUSTADO A TU VENTANA MODAL ---
      const prompt = `
        Actúa como un cajero que llena un formulario de pago.

        DATOS DE ENTRADA:
        - Texto Usuario: "${textoUsuario}"
        - Fecha Hoy: ${hoy}

        TU MISIÓN: Extraer los 5 datos clave para la base de datos.

        1. FOLIO: El número de la factura.
        2. FECHA ABONO: Si dice "hoy" usa ${hoy}, si dice "ayer" calcula la fecha.
        3. TIPO ABONO: Clasifica en: 'Transferencia', 'Efectivo', 'Cheque', 'Tarjeta', 'Otro'.
        4. MONTO ABONO: El dinero. Convierte "100 lucas" a 100000.
        5. DETALLE: Nota breve (ej: "Banco Santander", "Operación 123").

        Responde SOLO este JSON:
        {
          "folio": 123,
          "fecha_abono": "YYYY-MM-DD",
          "tipo_abono": "Texto",
          "monto_abono": 10000,
          "detalle": "Texto"
        }
      `;

      const result = await model.generateContent(prompt);
      const jsonLimpio = result.response
        .text()
        .replace(/```json|```/g, "")
        .trim();
      const datos = JSON.parse(jsonLimpio);

      if (!datos.folio) throw new Error("No escuché el número de factura.");

      // --- GUARDAR EN SUPABASE ---
      // ⚠️ IMPORTANTE: Aquí asumo que tus columnas en Supabase se llaman igual
      // que en tu diseño (usando guiones bajos). ¡Verifica esto en tu tabla!

      setMensaje(`Registrando abono a Fac #${datos.folio}...`);

      const { error } = await supabase
        .from("facturas")
        .update({
          estado: "pagado", // Asumimos que al registrar pago cambia el estado
          fecha_abono: datos.fecha_abono, // Campo 1 de tu imagen
          tipo_abono: datos.tipo_abono, // Campo 2 de tu imagen
          monto_abono: datos.monto_abono, // Campo 3 de tu imagen
          detalle: datos.detalle, // Campo 4 de tu imagen
        })
        .eq("folio", datos.folio);

      if (error) throw error;

      setEstado("exito");
      setMensaje(`✅ Abono registrado a Fac. ${datos.folio}`);

      setTimeout(() => {
        setEstado("idle");
        setMensaje("");
      }, 4000);
    } catch (e) {
      console.error(e);
      setEstado("error");
      setMensaje(`❌ Error: ${e.message}`);
      setTimeout(() => setEstado("idle"), 4000);
    }
  };

  const activarMicrofono = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Usa Chrome.");

    const recognition = new SpeechRecognition();
    recognition.lang = "es-CL";
    recognition.start();

    setEstado("escuchando");
    setMensaje(
      "Dime el pago... (ej: 'Abono de 200 lucas a la 105 por transferencia hoy')",
    );

    recognition.onresult = (e) => procesarOrden(e.results[0][0].transcript);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {mensaje && (
        <div className="mb-2 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-xl">
          {mensaje}
        </div>
      )}
      <button
        onClick={activarMicrofono}
        className={`h-16 w-16 rounded-full shadow-2xl text-3xl transition-transform transform hover:scale-105 ${
          estado === "escuchando"
            ? "bg-red-500 animate-pulse"
            : estado === "exito"
              ? "bg-green-500"
              : "bg-blue-600"
        } text-white`}
      >
        {estado === "escuchando" ? "🛑" : estado === "exito" ? "👍" : "🎙️"}
      </button>
    </div>
  );
};
