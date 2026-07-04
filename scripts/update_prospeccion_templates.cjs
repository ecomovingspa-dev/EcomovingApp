const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/Mario/Desktop/Replit/React-Vite-Starter/.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const TEMPLATES = [
  {
    nombre: 'consulta_directa',
    etiqueta: '1. Consulta Directa (Ice-Breaker)',
    orden: 1,
    dias_espera: 3, // 3 días para el siguiente paso
    asunto_template: 'Consulta rápida sobre merchandising en {empresa}',
    mensaje_intro: 'Hola {contacto}, espero que estés teniendo una excelente semana.\n\nTe escribo brevemente con la esperanza de poder conversar contigo o con quien corresponda en {empresa} sobre la gestión de merchandising o regalos corporativos.\n\nSé perfectamente que coordinar estos artículos suele ser un dolor de cabeza silencioso (buscar proveedores que respondan rápido, asegurarse de que los logos queden perfectos y cruzar los dedos para que todo llegue a tiempo para el evento o la campaña).\n\nSolo quería pasar a saludar y preguntar de manera muy abierta y relajada: ¿tienen planificado algún proyecto de regalos corporativos o merchandising en carpeta para estos meses en el que te vendría bien una mano?',
    mensaje_cierre: 'No pretendo quitarte tiempo vendiéndote algo a la fuerza hoy. Pero si te sirve tener una opción confiable, rápida y de alta calidad a mano para comparar o cotizar cuando lo necesites, me avisas y te comparto nuestras ideas más populares o el catálogo digital.\n\n¡Que tengas un excelente día!',
    activo: true
  },
  {
    nombre: 'alternativa_valor',
    etiqueta: '2. Alternativa de Valor (Follow-up)',
    orden: 2,
    dias_espera: 4, // 4 días para el siguiente paso
    asunto_template: 'Re: Consulta rápida sobre merchandising en {empresa}',
    mensaje_intro: 'Hola {contacto}, espero que vaya todo muy bien.\n\nTe escribo de manera muy breve en seguimiento a mi correo anterior, sobre el merchandising y regalos para su equipo en {empresa}.\n\nEntiendo perfectamente que las agendas en el día a día están a mil por hora, por lo que solo quería reiterarte nuestra total disposición. Si en algún momento planifican algún evento corporativo, bienvenida de colaboradores o fechas especiales, acá estamos para simplificarte el proceso y buscar ideas atractivas sin compromiso.',
    mensaje_cierre: 'Si estás tapado/a de pendientes en este momento, no te preocupes en responder ahora. Pero si te gustaría tener nuestro catálogo guardado para más adelante, me avisas con un breve "sí" y te lo envío encantado.\n\n¡Un abrazo y mucho éxito en tus actividades!',
    activo: true
  },
  {
    nombre: 'email_despedida',
    etiqueta: '3. Email de Despedida (Breakup)',
    orden: 3,
    dias_espera: 5,
    asunto_template: 'Cerrando contacto / Merchandising en {empresa}',
    mensaje_intro: 'Hola {contacto}, espero que te encuentres muy bien.\n\nTe escribo por última vez para no saturar tu bandeja de entrada. Como no hemos coincidido en esta oportunidad, asumo que el tema de regalos o merchandising no está dentro de tus prioridades o necesidades actuales en {empresa}, lo cual es totalmente comprensible.\n\nSi en el futuro cercano deciden buscar alternativas o necesitas solucionar una producción a contrarreloj con excelente calidad, nos encantará poder ayudarte.',
    mensaje_cierre: 'Te deseo el mayor de los éxitos en tus proyectos y metas del año. Si en algún momento nos necesitas, ya tienes mi contacto por esta vía.\n\n¡Que tengas una excelente semana!',
    activo: true
  }
];

async function run() {
  console.log("🚀 Iniciando actualización de plantillas de prospección en Supabase...");
  
  try {
    // 1. Limpiar configuración anterior
    console.log("🧹 Limpiando configuraciones antiguas...");
    const { error: deleteError } = await supabase
      .from('configuracion_prospeccion')
      .delete()
      .neq('id', 0); // Borrar todo

    if (deleteError) throw deleteError;

    // 2. Insertar las nuevas 3 plantillas
    console.log("➕ Insertando las nuevas 3 plantillas comerciales...");
    const { data, error: insertError } = await supabase
      .from('configuracion_prospeccion')
      .insert(TEMPLATES)
      .select();

    if (insertError) throw insertError;

    console.log("✅ ¡Plantillas actualizadas con éxito!");
    console.log("Resumen:");
    data.forEach(d => {
      console.log(` - [Orden ${d.orden}] ${d.etiqueta} | Asunto: ${d.asunto_template}`);
    });

  } catch (err) {
    console.error("❌ Error en el proceso:", err.message);
  }
}

run();
