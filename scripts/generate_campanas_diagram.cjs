const { jsPDF } = require('jspdf');
const fs = require('fs');
const path = require('path');

// Inicializar documento A4 horizontal (297mm x 210mm) para mejor visualización del flujo lado a lado
const doc = new jsPDF({
  orientation: 'landscape',
  unit: 'mm',
  format: 'a4'
});

// Paleta de colores Premium de Ecomoving
const COLORS = {
  bg: [15, 23, 42],           // #0F172A (Azul Oscuro Slate)
  prospeccion: [124, 58, 237], // #7C3AED (Violeta)
  marketing: [37, 99, 235],    // #2563EB (Azul)
  activo: [16, 185, 129],     // #10B981 (Esmeralda)
  inactivo: [239, 68, 68],    // #EF4444 (Rojo)
  textDark: [51, 65, 85],       // #334155
  slateLight: [241, 245, 249],  // #F1F5F9
  border: [203, 213, 225]       // #CBD5E1
};

// 1. Encabezado del Documento
doc.setFillColor(COLORS.bg[0], COLORS.bg[1], COLORS.bg[2]);
doc.rect(0, 0, 297, 28, 'F');

doc.setTextColor(255, 255, 255);
doc.setFont('helvetica', 'bold');
doc.setFontSize(15);
doc.text("ECOMOVING SpA - ORQUESTADOR DE CAMPAÑAS CRM", 15, 11);

doc.setFont('helvetica', 'normal');
doc.setFontSize(9.5);
doc.setTextColor(148, 163, 184); // Slate Light
doc.text("Estructura de Rieles de Envío: Prospección (Cold Outreach) vs. Marketing (Nurturing) y Control de Estados", 15, 17);
doc.text("Guía Técnica de Estados, Transiciones (Graduación/Degradación) y Pausas en la Base de Datos", 15, 22);

// Fecha
doc.setFontSize(8.5);
doc.setTextColor(148, 163, 184);
doc.text(`Generado: ${new Date().toLocaleDateString('es-CL')}`, 250, 11);

// Funciones de dibujo de Cajas
function drawCard(x, y, w, h, title, text, type, align = 'center') {
  let headerColor = COLORS[type] || [100, 116, 139];
  
  // Dibujar cuerpo de la tarjeta (blanco con sombra sutil)
  doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');
  
  // Encabezado de la tarjeta
  doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
  doc.roundedRect(x, y, w, 6, 2, 2, 'F');
  // Rectángulo inferior para tapar curvas inferiores del encabezado
  doc.rect(x, y + 4, w, 2, 'F');
  
  // Título de la tarjeta
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(title, x + w/2, y + 4.2, { align: 'center' });
  
  // Texto descriptivo interno
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  
  const lines = text.split('\n');
  let startY = y + 10;
  lines.forEach((line, i) => {
    if (line.startsWith('•')) {
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setFont('helvetica', 'normal');
    }
    doc.text(line, align === 'center' ? x + w/2 : x + 4, startY + (i * 3.5), { align: align });
  });
}

function drawConnector(x1, y1, x2, y2, label = "", style = "solid", color = [100, 116, 139]) {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.4);
  
  if (style === "dashed") {
    // Dibujar línea punteada manual
    const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const segments = Math.floor(distance / 2);
    const dx = (x2 - x1) / segments;
    const dy = (y2 - y1) / segments;
    for (let i = 0; i < segments; i += 2) {
      doc.line(x1 + dx * i, y1 + dy * i, x1 + dx * (i + 1), y1 + dy * (i + 1));
    }
  } else {
    doc.line(x1, y1, x2, y2);
  }
  
  // Punta de la flecha
  if (x1 === x2) { // Vertical
    const dir = y2 > y1 ? 1 : -1;
    doc.line(x2, y2, x2 - 1.5, y2 - (2.5 * dir));
    doc.line(x2, y2, x2 + 1.5, y2 - (2.5 * dir));
    if (label) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(label, x1 + 2.5, (y1 + y2)/2 + 1, { align: 'left' });
    }
  } else if (y1 === y2) { // Horizontal
    const dir = x2 > x1 ? 1 : -1;
    doc.line(x2, y2, x2 - (2.5 * dir), y2 - 1.5);
    doc.line(x2, y2, x2 - (2.5 * dir), y2 + 1.5);
    if (label) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(label, (x1 + x2)/2, y1 - 2, { align: 'center' });
    }
  }
}

// 2. LADO IZQUIERDO: CAMPAÑA DE PROSPECCIÓN (VIOLETA)
doc.setFillColor(250, 245, 255); // Fondo violeta claro
doc.roundedRect(10, 34, 110, 118, 3, 3, 'F');
doc.setDrawColor(233, 213, 255);
doc.roundedRect(10, 34, 110, 118, 3, 3, 'D');

doc.setTextColor(COLORS.prospeccion[0], COLORS.prospeccion[1], COLORS.prospeccion[2]);
doc.setFont('helvetica', 'bold');
doc.setFontSize(11);
doc.text("1. CAMPAÑA DE PROSPECCIÓN", 15, 41);
doc.setFont('helvetica', 'normal');
doc.setFontSize(7.5);
doc.setTextColor(126, 34, 206);
doc.text("riel: etapa = 'prospeccion'  |  plantillas: configuracion_prospeccion", 15, 45);

// Tarjeta: Control de Estado en Prospección
drawCard(20, 52, 40, 26, "INTERRUPTOR DE PLAY / PAUSE", "prospeccion", 
  "¿Estado del contacto?\n• Activo: Entra al Cron diario\n• Inactivo: Envío congelado\n\n(Se activa con botón ▶️)");

// Etapas de envío en Prospección
drawCard(75, 52, 35, 16, "ETAPA 1: ICE-BREAKER", "prospeccion", "Pregunta inicial buscando\nal encargado del área.");
drawCard(75, 76, 35, 16, "ETAPA 2: FOLLOW-UP", "prospeccion", "Seguimiento al cabo de\n3 días hábiles.");
drawCard(75, 100, 35, 16, "ETAPA 3: BREAKUP", "prospeccion", "Despedida / Cierre de hilo\nal cabo de 4 días hábiles.");

// Conectores internos de Prospección
drawConnector(40, 78, 40, 96, "Activar ▶️");
drawConnector(92.5, 68, 92.5, 76);
drawConnector(92.5, 92, 92.5, 100);

// Conectores entre Estado y Proceso
doc.setDrawColor(124, 58, 237);
doc.line(60, 65, 75, 65);
doc.line(75, 65, 72, 63.5);
doc.line(75, 65, 72, 66.5);
doc.setFont('helvetica', 'bold');
doc.setFontSize(6.5);
doc.text("Si está Activo", 67.5, 63, { align: 'center' });


// 3. LADO DERECHO: CAMPAÑA DE MARKETING (AZUL)
doc.setFillColor(239, 246, 255); // Fondo azul claro
doc.roundedRect(177, 34, 110, 118, 3, 3, 'F');
doc.setDrawColor(191, 219, 254);
doc.roundedRect(177, 34, 110, 118, 3, 3, 'D');

doc.setTextColor(COLORS.marketing[0], COLORS.marketing[1], COLORS.marketing[2]);
doc.setFont('helvetica', 'bold');
doc.setFontSize(11);
doc.text("2. CAMPAÑA DE MARKETING (NURTURING)", 182, 41);
doc.setFont('helvetica', 'normal');
doc.setFontSize(7.5);
doc.setTextColor(29, 78, 216);
doc.text("riel: etapa = 'marketing'  |  plantillas: marketing", 182, 45);

// Tarjeta: Control de Estado en Marketing
doc.setFont('helvetica', 'bold');
drawCard(187, 52, 40, 26, "INTERRUPTOR DE PLAY / PAUSE", "marketing", 
  "¿Estado del contacto?\n• Activo: Recibe secuencia\n• Inactivo: Nutrición pausada\n\n(Se controla en ficha/tabla)");

// Proceso de Marketing
drawCard(242, 52, 35, 64, "SECUENCIA DE NUTRICIÓN", "marketing", 
  "Campaña de 13 Etapas:\n\n• Etapa 1: Ecosistema\n• Etapa 2: Hidratación\n• Etapa 3: Estética Zen\n• Etapa 4: Lonchera\n• Etapa 5: Escritorio\n• Etapa 6: Premium\n• Etapa 7: Funcionalidad\n• Etapa 8: Mochilas\n  ... y más.");

// Conectores entre Estado y Marketing
doc.setDrawColor(37, 99, 235);
doc.line(227, 65, 242, 65);
doc.line(242, 65, 239, 63.5);
doc.line(242, 65, 239, 66.5);
doc.setFont('helvetica', 'bold');
doc.setFontSize(6.5);
doc.text("Si está Activo", 234.5, 63, { align: 'center' });


// 4. TRANSICIONES (CONECTOR CENTRAL)
// A. GRADUACIÓN (De Prospección a Marketing)
drawConnector(120, 70, 177, 70, "GRADUACIÓN (SÍ: Contacto Tomador de Decisiones Identificado)", "solid", COLORS.activo);
doc.setFont('helvetica', 'normal');
doc.setFontSize(6);
doc.setTextColor(51, 65, 85);
doc.text("Cambia etapa = 'marketing' | estado = 'inactivo' (por IA/Manual)", 148.5, 73.5, { align: 'center' });

// B. DEGRADACIÓN (De Marketing a Prospección)
drawConnector(177, 105, 120, 105, "DEGRADACIÓN / RESET (Rebotó o no era la persona correcta)", "dashed", COLORS.inactivo);
doc.text("Cambia etapa = 'prospeccion' | etapa_envio = 1 | estado = 'activo'", 148.5, 108.5, { align: 'center' });


// 5. CAJA EXPLICATIVA INFERIOR (NOTAS TÉCNICAS)
doc.setFillColor(COLORS.slateLight[0], COLORS.slateLight[1], COLORS.slateLight[2]);
doc.rect(10, 158, 277, 42, 'F');
doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
doc.rect(10, 158, 277, 42, 'D');

doc.setFont('helvetica', 'bold');
doc.setFontSize(8.5);
doc.setTextColor(COLORS.bg[0], COLORS.bg[1], COLORS.bg[2]);
doc.text("GUÍA RÁPIDA DE COMPORTAMIENTO PARA OPERADORES Y DESARROLLADORES", 15, 163);

doc.setFont('helvetica', 'normal');
doc.setFontSize(7.5);
doc.setTextColor(51, 65, 85);
doc.text("• Campaña de Prospección (Morada): Destinada a buscar al tomador de decisiones. Usa correos generales (como el Ice-Breaker) para gatillar respuesta.", 15, 169);
doc.text("  Un contacto nuevo ingresa inactivo. Al pulsar el botón de Play (▶️) en la interfaz, se activa y el cron diario le envía la Etapa 1.", 15, 173);

doc.text("• Campaña de Marketing (Azul): Destinada a enviar catálogo y nutrición a un contacto real verificado (ej: Juan Pérez, Gerente de Marketing).", 15, 178);
doc.text("  Tiene 13 etapas automáticas que avanzan secuencialmente. Si el contacto pasa a Inactivo, la secuencia se congela y no avanza.", 15, 182);

doc.text("• Transición de Rieles: Para pasar de Marketing a Prospección (degradación) debes asegurar de resetear el indicador de secuencia 'etapa_envio' a 1.", 15, 187);
doc.text("  Esto es crucial para que el contacto no empiece la prospección desde la etapa 4 (la cual no existe y trabaría su cola de envío).", 15, 191);

doc.text("• Flujo Agéntico: Cuando la IA encuentra en internet a un prospecto calificado con nombre real, lo crea por defecto inactivo en el riel de Prospección", 15, 196);
doc.text("  para revisión manual. El operador decide si activarlo para buscar contacto o graduarlo a Marketing directo sin realizar prospección.", 15, 200);


// Guardar documento
const pdfPath = 'c:/Users/Mario/Desktop/Replit/React-Vite-Starter/ecomoving_campanas_crm.pdf';
try {
  const output = doc.output('arraybuffer');
  fs.writeFileSync(pdfPath, Buffer.from(output));
  console.log(`✅ Diagrama guardado en PDF: ${pdfPath}`);
} catch (err) {
  console.error("Error al generar PDF:", err.message);
}
