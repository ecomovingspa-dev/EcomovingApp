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
    mensaje_intro: 'Hola al equipo de {empresa},\n\nLes escribo porque estoy intentando dar con la persona encargada de Regalos Corporativos o Sustentabilidad en su oficina.\n\nEn Ecomoving ayudamos a empresas a diseñar merchandising premium de triple impacto (hecho de materiales reciclados, acero y madera certificada) que realmente represente sus políticas de sostenibilidad.\n\n¿Me podrían orientar sobre con quién conversar o a qué correo dirigir esta consulta?',
    mensaje_cierre: 'Muchas gracias por su tiempo y orientación.\n\nSaludos,\nEquipo Ecomoving',
    activo: true
  },
  {
    nombre: 'alternativa_valor',
    etiqueta: '2. Alternativa de Valor (Follow-up)',
    orden: 2,
    dias_espera: 4, // 4 días para el siguiente paso
    asunto_template: 'Re: Pregunta rápida sobre regalos corporativos en {empresa}',
    mensaje_intro: 'Hola de nuevo,\n\nSé que en el buzón de {empresa} reciben muchos correos diarios, por lo que seré muy breve.\n\nDiseñamos soluciones de merchandising ecológico que ayudan a las marcas a reducir su huella plástica en eventos corporativos y kits de bienvenida para nuevos colaboradores (onboarding).\n\n¿Habrá alguna posibilidad de que me faciliten el contacto de la persona a cargo de Compras o Marketing para hacerle llegar nuestro catálogo de este mes?',
    mensaje_cierre: 'Agradezco de corazón cualquier ayuda para canalizar este mensaje.\n\nUn cordial saludo,\nEquipo Ecomoving',
    activo: true
  },
  {
    nombre: 'email_despedida',
    etiqueta: '3. Email de Despedida (Breakup)',
    orden: 3,
    dias_espera: 5,
    asunto_template: 'Cerrando este hilo / Merchandising en {empresa}',
    mensaje_intro: 'Hola equipo,\n\nLes escribo por última vez para no saturar su buzón. Como no he tenido respuesta, asumo que la renovación de regalos corporativos o merchandising sustentable no son una prioridad en {empresa} en este momento.\n\nSi las cosas cambian más adelante y necesitan alternativas ecológicas y certificadas para sus campañas, estaré encantado de ayudarles.',
    mensaje_cierre: 'Les deseo el mayor de los éxitos en sus proyectos.\n\nAtentamente,\nEquipo Ecomoving',
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
