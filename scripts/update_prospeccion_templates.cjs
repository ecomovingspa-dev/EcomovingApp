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
    asunto_template: 'Pregunta rápida sobre regalos corporativos en {empresa}',
    mensaje_intro: 'Hola al equipo de {empresa},\n\nJunto con saludarlos, les escribo brevemente para dar con la persona encargada de <strong>Marketing, Comunicaciones, Compras o Regalos Corporativos</strong> en su empresa.\n\nEn Ecomoving nos especializamos en simplificar la búsqueda y abastecimiento de merchandising y regalos publicitarios (desde botellas y mugs térmicos hasta mochilas, libretas y tecnología), ofreciendo opciones con y sin personalización corporativa de alta calidad.\n\n¿Me podrían orientar sobre con quién ponerme en contacto o a qué correo directo podría dirigir esta propuesta?',
    mensaje_cierre: 'De antemano, muchísimas gracias por su tiempo y ayuda.\n\nSaludos cordiales,\nEquipo Ecomoving',
    activo: true
  },
  {
    nombre: 'alternativa_valor',
    etiqueta: '2. Alternativa de Valor (Follow-up)',
    orden: 2,
    dias_espera: 4, // 4 días para el siguiente paso
    asunto_template: 'Re: Pregunta rápida sobre regalos corporativos en {empresa}',
    mensaje_intro: 'Hola de nuevo al equipo de {empresa},\n\nEspero que se encuentren muy bien. Les escribo brevemente en relación al correo anterior, con la intención de contactar a la persona encargada de <strong>Marketing, Comunicaciones, Compras o Regalos Corporativos</strong> en su empresa.\n\nEntendemos que sus agendas son exigentes, por lo que seremos muy breves. Queremos ayudarles a simplificar y optimizar la búsqueda de sus regalos corporativos y merchandising para sus eventos o colaboradores.\n\n¿Será posible que nos compartan el contacto o nos indiquen a qué correo directo dirigir nuestro catálogo?',
    mensaje_cierre: 'Agradecemos enormemente cualquier ayuda para canalizar este mensaje.\n\nAtentamente,\nEquipo Ecomoving',
    activo: true
  },
  {
    nombre: 'email_despedida',
    etiqueta: '3. Email de Despedida (Breakup)',
    orden: 3,
    dias_espera: 5,
    asunto_template: 'Cerrando este contacto / Merchandising en {empresa}',
    mensaje_intro: 'Hola al equipo de {empresa},\n\nLes escribo por última vez para no saturar su bandeja de entrada. Como no hemos recibido respuesta, asumimos que simplificar el abastecimiento de regalos publicitarios o merchandising no es una prioridad en su empresa en este momento.\n\nSi en el futuro necesitan una alternativa eficiente y de alta calidad para botellas térmicas, mochilas, tecnología o libretas corporativas, estaremos encantados de ayudarles.',
    mensaje_cierre: 'Les deseo mucho éxito en sus proyectos.\n\nSaludos cordiales,\nEquipo Ecomoving',
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
