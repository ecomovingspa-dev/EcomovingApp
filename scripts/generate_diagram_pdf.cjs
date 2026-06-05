const { jsPDF } = require('jspdf');
const fs = require('fs');
const path = require('path');

// Inicializar documento A4 (210mm x 297mm)
const doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: 'a4'
});

// Paleta de colores Premium (Dark Luxury & Professional)
const COLORS = {
  bg: [15, 23, 42],       // #0F172A (Azul Oscuro Slate)
  textLight: [248, 250, 252], // #F8FAFC
  textDark: [51, 65, 85],   // #334155
  border: [226, 232, 240],  // #E2E8F0
  
  // Categorías de flujo (Legenda)
  user: [139, 92, 246],    // #8B5CF6 (Púrpura - Acciones de Usuario)
  agent: [14, 165, 233],   // #0EA5E9 (Azul Celeste - IA / Agente)
  db: [30, 41, 59],         // #1E293B (Gris Slate - Base de Datos)
  mail: [16, 185, 129],     // #10B981 (Esmeralda - Correos)
  error: [239, 68, 68]      // #EF4444 (Rojo - Excepciones "NO")
};

// 1. Encabezado del Documento
doc.setFillColor(COLORS.bg[0], COLORS.bg[1], COLORS.bg[2]);
doc.rect(0, 0, 210, 25, 'F');

doc.setTextColor(COLORS.textLight[0], COLORS.textLight[1], COLORS.textLight[2]);
doc.setFont('helvetica', 'bold');
doc.setFontSize(14);
doc.text("ECOMOVING SpA - INTELIGENCIA CRM v2.0", 15, 10);
doc.setFont('helvetica', 'normal');
doc.setFontSize(9);
doc.setTextColor(148, 163, 184); // Slate ligero
doc.text("Flujo Agéntico Autónomo: Sourcing de Cuentas y Enriquecimiento de Contactos", 15, 15);
doc.text("Estado: Propuesta de Diseño de Flujo", 15, 20);

// Fecha del documento
doc.setFontSize(8);
doc.text(`Generado: ${new Date().toLocaleDateString('es-CL')}`, 170, 10);

// Funciones Auxiliares para Dibujar Cajas
function drawBox(x, y, w, h, text, category, isBorder = false) {
  const col = COLORS[category];
  if (isBorder) {
    doc.setDrawColor(col[0], col[1], col[2]);
    doc.setLineWidth(0.4);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, w, h, 1.5, 1.5, 'FD');
    doc.setTextColor(col[0], col[1], col[2]);
  } else {
    doc.setFillColor(col[0], col[1], col[2]);
    doc.roundedRect(x, y, w, h, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
  }
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  
  // Soporte para texto multilinea simple
  const lines = text.split('\n');
  if (lines.length === 1) {
    doc.text(text, x + w/2, y + h/2 + 1, { align: 'center' });
  } else {
    doc.text(lines[0], x + w/2, y + h/2 - 1, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(lines[1], x + w/2, y + h/2 + 2.5, { align: 'center' });
  }
}

function drawArrow(x1, y1, x2, y2, label = "", alignLabel = 'center') {
  doc.setDrawColor(100, 116, 139); // Slate suave
  doc.setLineWidth(0.3);
  doc.line(x1, y1, x2, y2);
  
  // Dibujar punta de flecha
  if (y1 === y2) { // Horizontal
    const dir = x2 > x1 ? 1 : -1;
    doc.line(x2, y2, x2 - (2 * dir), y2 - 1);
    doc.line(x2, y2, x2 - (2 * dir), y2 + 1);
    if (label) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text(label, (x1 + x2)/2, y1 - 1, { align: 'center' });
    }
  } else if (x1 === x2) { // Vertical
    const dir = y2 > y1 ? 1 : -1;
    doc.line(x2, y2, x2 - 1, y2 - (2 * dir));
    doc.line(x2, y2, x2 + 1, y2 - (2 * dir));
    if (label) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      if (alignLabel === 'left') {
        doc.text(label, x1 - 2, (y1 + y2)/2 + 1, { align: 'right' });
      } else {
        doc.text(label, x1 + 2, (y1 + y2)/2 + 1, { align: 'left' });
      }
    }
  }
}

// 2. DIBUJAR LA LEYENDA EN EL LATERAL DERECHO
doc.setFont('helvetica', 'bold');
doc.setFontSize(9);
doc.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
doc.text("LEYENDA DE ACTORES", 155, 38);
doc.line(155, 40, 200, 40);

const legendItems = [
  { cat: 'user', name: 'Usuario (Manual)' },
  { cat: 'agent', name: 'Agente IA (Autónomo)' },
  { cat: 'db', name: 'Base de Datos (CRM)' },
  { cat: 'mail', name: 'Canal de Correos' },
  { cat: 'error', name: 'Caminos NO / Falla' }
];

legendItems.forEach((item, index) => {
  const ly = 45 + (index * 8);
  doc.setFillColor(COLORS[item.cat][0], COLORS[item.cat][1], COLORS[item.cat][2]);
  doc.circle(158, ly + 1, 1.5, 'F');
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(item.name, 163, ly + 2);
});

// Nota explicativa
doc.setFillColor(248, 250, 252);
doc.roundedRect(155, 88, 45, 25, 1, 1, 'F');
doc.setFont('helvetica', 'italic');
doc.setFontSize(6.5);
doc.setTextColor(100, 116, 139);
doc.text("Este diagrama detalla los", 157, 92);
doc.text("caminos autónomos del", 157, 95);
doc.text("agente y los canales de", 157, 98);
doc.text("excepción (NO) sin cruces", 157, 101);
doc.text("ambiguos de líneas.", 157, 104);

// 3. DIBUJAR EL DIAGRAMA DE FLUJO PRINCIPAL (Columna Central)

// --- FILA 1 ---
// Inicio: Cuenta creada y activa
drawBox(55, 32, 70, 10, "Usuario ingresa Cuenta\ny la marca como 'Activa'", "user");

// Flecha a Búsqueda Web
drawArrow(90, 42, 90, 48);

// --- FILA 2 ---
// Búsqueda Web Agéntica
drawBox(55, 48, 70, 10, "Búsqueda Web Autónoma\nde Contactos y Sitio", "agent");

// Flecha a Decisión de Datos
drawArrow(90, 58, 90, 64);

// Decisión: ¿Encontró datos?
drawBox(75, 64, 30, 10, "¿Encontró datos?\n(Evalúa IA)", "agent", true);

// CAMINO NO 1: Sin datos
drawArrow(75, 69, 40, 69, "NO");
drawBox(10, 64, 30, 10, "Alerta en la UI:\n'Revisión Manual'", "error", true);

// CAMINO SÍ 1: Sí hay datos -> Guardar Contacto
drawArrow(90, 74, 90, 80, "SÍ");

// --- FILA 3 ---
// Guardar Contacto Inicial como Inactivo
drawBox(55, 80, 70, 10, "Guarda Contacto Inicial\nestado: 'Inactivo'", "db");

// Flecha a Envío de Correo Amistoso
drawArrow(90, 90, 90, 96);

// --- FILA 4 ---
// Envío Correo Amistoso
drawBox(55, 96, 70, 10, "Envío Autónomo:\nCorreo Amistoso (Intro)", "mail");

// FLECHAS DE SALIDA DE ENVIAR CORREO AMISTOSO

// CAMINO NO 2: Rebote inmediato
// Flecha a la IZQUIERDA directo a Rebote
drawArrow(55, 101, 40, 101, "Rebote (Bounce)");
drawBox(10, 96, 30, 10, "Bloquear Contacto\nMarcar 'hard_bounce'", "error", true);

// CAMINO SÍ 2: Cliente responde al Amistoso
// Flecha hacia ABAJO para el caso exitoso directo
drawArrow(90, 106, 90, 142, "Responde con Interés / Datos", 'left');

// CAMINO NO 3: Silencio (No responde al Amistoso)
// Flecha a la DERECHA para ir al Loop de Seguimiento
drawArrow(125, 101, 155, 101, "No Responde (Silencio)");

// --- COLUMNA DERECHA (Seguimiento / Follow-Up) ---
drawBox(155, 96, 40, 10, "Esperar 3 Días Hábiles\n(Según cron de Prospección)", "agent", true);
drawArrow(175, 106, 175, 114);
drawBox(155, 114, 40, 10, "Envío Autónomo:\nCorreo de Seguimiento", "mail");

// (EL TRAMO DESTACADO Y TEXTO 'REBOTE EN SEGUIMIENTO' HAN SIDO COMPLETAMENTE ELIMINADOS DE AQUÍ PARA EVITAR CRUCES Y AMBIGÜEDADES)

// Respuestas al Seguimiento (Va directo a la decisión del agente J)
drawArrow(155, 119, 125, 147, "Responde");

// Silencio definitivo tras Seguimiento
drawArrow(175, 124, 175, 142, "Sigue sin responder (5 días)");
drawBox(155, 142, 40, 10, "Marcar 'Sin Respuesta'\nDetener envíos", "error", true);


// --- FILA 5 (Evaluación de Respuestas) ---
// Decisión del agente sobre el tipo de respuesta (Caja clásica)
drawBox(65, 142, 50, 10, "¿Da el contacto?\n(Análisis IA de respuesta)", "agent", true);

// CAMINO NO 4: Rechazo / Opt-Out
drawArrow(65, 147, 40, 147, "NO: Rechazo");
drawBox(10, 142, 30, 10, "Blacklist / Desuscrito\nInactivo + Bloqueado", "error", true);

// CAMINO SÍ 4: Respuesta exitosa
drawArrow(90, 152, 90, 158, "SÍ");

// --- FILA 6 ---
// Agente extrae datos reales
drawBox(55, 158, 70, 10, "Agente procesa e interactúa\npara extraer datos reales", "agent");
drawArrow(90, 168, 90, 174);

// --- FILA 7 ---
// Graduación exitosa
drawBox(55, 174, 70, 12, "Actualiza Contacto\netapa: 'marketing'\nestado: 'Inactivo'", "db");
drawArrow(90, 186, 90, 194);

// --- FILA 8 (Control Humano Final) ---
drawBox(55, 194, 70, 10, "UI destaca el Contacto\ncon color de fondo especial", "user", true);
drawArrow(90, 204, 90, 210);

doc.setFont('helvetica', 'bold');
drawBox(55, 210, 70, 10, "Activar manualmente en UI\npara campañas activas", "user");


// 4. TEXTO EXPLICATIVO DE DISEÑO (Sección inferior)
doc.setFillColor(241, 245, 249);
doc.rect(10, 230, 190, 50, 'F');
doc.setDrawColor(203, 213, 225);
doc.rect(10, 230, 190, 50, 'D');

doc.setFont('helvetica', 'bold');
doc.setFontSize(8.5);
doc.setTextColor(COLORS.bg[0], COLORS.bg[1], COLORS.bg[2]);
doc.text("NOTAS DE IMPLEMENTACIÓN TÉCNICA EN ECOMOVINGAPP", 15, 236);

doc.setFont('helvetica', 'normal');
doc.setFontSize(7.5);
doc.setTextColor(51, 65, 85);
doc.text("• Control del Estado: Tanto el Escenario A como el B ingresan estrictamente con estado = 'Inactivo' en Supabase.", 15, 242);
doc.text("  Esto congela al contacto y garantiza que ningún cron automático le escriba sin tu consentimiento.", 15, 246);
doc.text("• Diferenciador de Etapa: La única distinción entre un contacto general y uno personalizado es la columna 'etapa'", 15, 252);
doc.text("  ('prospeccion' = correo general para buscar interlocutor; 'marketing' = contacto real con nombre e email listo).", 15, 256);
doc.text("• Autonomía Segura: El agente realiza la investigación web, gestiona las respuestas de prospección y gradúa", 15, 262);
doc.text("  el contacto a la etapa de marketing automáticamente. El usuario solo actúa al inicio (detonante) y al final (activar).", 15, 266);
doc.text("• Retroalimentación Visual: La UI coloreará de fondo el registro para llamar la atención del operador del CRM.", 15, 272);

// Guardar el PDF en el espacio de trabajo del usuario
const pdfDir = 'c:/Users/Mario/Desktop/Replit/React-Vite-Starter';
const pdfName = 'ecomoving_flujo_prospeccion_marketing.pdf';
const fullPdfPath = path.join(pdfDir, pdfName);

try {
  const pdfOutput = doc.output('arraybuffer');
  fs.writeFileSync(fullPdfPath, Buffer.from(pdfOutput));
  console.log(`✅ PDF generado exitosamente en: ${fullPdfPath}`);
} catch (e) {
  console.error("Error al guardar el PDF:", e);
}
