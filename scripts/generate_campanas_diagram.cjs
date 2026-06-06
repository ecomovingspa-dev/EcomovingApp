const { jsPDF } = require('jspdf');
const fs = require('fs');
const path = require('path');

// Inicializar documento A4 horizontal (297mm x 210mm)
const doc = new jsPDF({
  orientation: 'landscape',
  unit: 'mm',
  format: 'a4'
});

// Paleta de colores Premium de Ecomoving
const COLORS = {
  bg: [15, 23, 42],           // #0F172A (Azul Oscuro Slate)
  prospeccion: [124, 58, 237], // #7C3AED (Violeta - Desactivado)
  marketing: [37, 99, 235],    // #2563EB (Azul - Activo)
  switchOn: [16, 185, 129],    // #10B981 (Verde)
  switchOff: [100, 116, 139],  // #64748B (Gris)
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
doc.text("ECOMOVING SpA - ENRUTADOR DE CAMPAÑAS CRM", 15, 11);

doc.setFont('helvetica', 'normal');
doc.setFontSize(9.5);
doc.setTextColor(148, 163, 184); // Slate Light
doc.text("Control Simplificado por Interruptor: Campaña de Prospección (Desactivado) vs. Campaña de Marketing (Activo)", 15, 17);
doc.text("Guía Visual de Estados del Switch, Transiciones Inmediatas y Flujo del Cron diario", 15, 22);

// Fecha
doc.setFontSize(8.5);
doc.setTextColor(148, 163, 184);
doc.text(`Generado: ${new Date().toLocaleDateString('es-CL')}`, 250, 11);

// Funciones de dibujo de Cajas
function drawCard(x, y, w, h, title, text, type, align = 'center') {
  let headerColor = COLORS[type] || [100, 116, 139];
  
  doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');
  
  doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
  doc.roundedRect(x, y, w, 6, 2, 2, 'F');
  doc.rect(x, y + 4, w, 2, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(title, x + w/2, y + 4.2, { align: 'center' });
  
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  
  const lines = text.split('\n');
  let startY = y + 10;
  lines.forEach((line, i) => {
    if (line.startsWith('•') || line.startsWith('⚡')) {
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

// 2. CONTROL CENTRAL: EL INTERRUPTOR DE CAMPAÑA (SWITCH)
// Dibujar el panel del switch en el centro de la pantalla
doc.setFillColor(COLORS.slateLight[0], COLORS.slateLight[1], COLORS.slateLight[2]);
doc.roundedRect(118, 38, 60, 110, 3, 3, 'F');
doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
doc.roundedRect(118, 38, 60, 110, 3, 3, 'D');

doc.setFont('helvetica', 'bold');
doc.setFontSize(9);
doc.setTextColor(COLORS.bg[0], COLORS.bg[1], COLORS.bg[2]);
doc.text("INTERRUPTOR DE CAMPAÑA", 148, 45, { align: 'center' });
doc.setFont('helvetica', 'normal');
doc.setFontSize(7);
doc.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
doc.text("(Control de Rieles en UI)", 148, 49, { align: 'center' });

// Dibujar interruptor en Estado Desactivado (Izquierda / Prospección)
doc.setFillColor(200, 200, 200);
doc.roundedRect(128, 56, 16, 8, 4, 4, 'F');
doc.setFillColor(255, 255, 255);
doc.circle(132, 60, 3, 'F');
doc.setFont('helvetica', 'bold');
doc.setFontSize(7);
doc.setTextColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2]);
doc.text("DESACTIVADO", 148, 68, { align: 'center' });
doc.setFont('helvetica', 'normal');
doc.setFontSize(6);
doc.text("etapa: 'prospeccion'", 148, 71, { align: 'center' });

// Dibujar interruptor en Estado Activo (Derecha / Marketing)
doc.setFillColor(34, 197, 94); // Verde
doc.roundedRect(152, 82, 16, 8, 4, 4, 'F');
doc.setFillColor(255, 255, 255);
doc.circle(164, 86, 3, 'F');
doc.setFont('helvetica', 'bold');
doc.setFontSize(7);
doc.setTextColor(22, 101, 52);
doc.text("ACTIVO (VERDE)", 160, 94, { align: 'center' });
doc.setFont('helvetica', 'normal');
doc.setFontSize(6);
doc.text("etapa: 'marketing'", 160, 97, { align: 'center' });

// Tarjeta informativa del Switch
drawCard(123, 106, 50, 36, "REGLAS DE GESTIÓN", "bg", 
  "⚡ Toggles Directos:\n• Switch OFF ➡️ Prospección\n• Switch ON ➡️ Marketing\n\n⚡ Congelación y Limpieza:\n• Si no sirve el lead ➡️ Eliminar\n• Si se degrada ➡️ Entra a frío\ny congela marketing.");


// 3. SECCIÓN IZQUIERDA: CAMPAÑA DE PROSPECCIÓN (VIOLETA - OFF)
doc.setFillColor(250, 245, 255); // Fondo violeta claro
doc.roundedRect(10, 38, 100, 110, 3, 3, 'F');
doc.setDrawColor(233, 213, 255);
doc.roundedRect(10, 38, 100, 110, 3, 3, 'D');

doc.setTextColor(COLORS.prospeccion[0], COLORS.prospeccion[1], COLORS.prospeccion[2]);
doc.setFont('helvetica', 'bold');
doc.setFontSize(10.5);
doc.text("CAMPAÑA DE PROSPECCIÓN", 15, 45);
doc.setFont('helvetica', 'normal');
doc.setFontSize(7);
doc.setTextColor(126, 34, 206);
doc.text("Secuencia Fría (Búsqueda de Contacto)", 15, 49);

// Pasos de Prospección
drawCard(18, 56, 84, 18, "ETAPA 1: ICE-BREAKER (Primer Contacto)", "prospeccion", 
  "Hola al equipo de {empresa},\nJunto con saludarlos, les escribo para dar con la persona encargada de...", 'left');
drawCard(18, 80, 84, 15, "ETAPA 2: ALTERNATIVA DE VALOR (Follow-up)", "prospeccion", 
  "Espero que se encuentren bien. Les escribo en relación al correo anterior...", 'left');
drawCard(18, 101, 84, 15, "ETAPA 3: EMAIL DE DESPEDIDA (Breakup)", "prospeccion", 
  "Les escribo por última vez. Asumimos que simplificar el abastecimiento...", 'left');

// Conectores internos de Prospección
drawConnector(60, 74, 60, 80);
drawConnector(60, 95, 60, 101);


// 4. SECCIÓN DERECHA: CAMPAÑA DE MARKETING (AZUL - ON)
doc.setFillColor(239, 246, 255); // Fondo azul claro
doc.roundedRect(187, 38, 100, 110, 3, 3, 'F');
doc.setDrawColor(191, 219, 254);
doc.roundedRect(187, 38, 100, 110, 3, 3, 'D');

doc.setTextColor(COLORS.marketing[0], COLORS.marketing[1], COLORS.marketing[2]);
doc.setFont('helvetica', 'bold');
doc.setFontSize(10.5);
doc.text("CAMPAÑA DE MARKETING", 192, 45);
doc.setFont('helvetica', 'normal');
doc.setFontSize(7);
doc.setTextColor(29, 78, 216);
doc.text("Secuencia de Nutrición (Contacto Verificado)", 192, 49);

// Pasos de Marketing
drawCard(195, 56, 84, 80, "SECUENCIA DE NUTRICIÓN PREMIUM (13 PASOS)", "marketing", 
  "Envío de correos automáticos sobre productos de triple impacto:\n\n• Etapa 1: Ecosistema integral corporativo\n• Etapa 2: Hidratación Sostenible Corporativa\n• Etapa 3: Estética Zen & Alto Desempeño\n• Etapa 4: Lonchera térmica: funcionalidad\n• Etapa 5: Organización práctica para su escritorio\n• Etapa 6: Detalles premium para su equipo\n• Etapa 7: Calidad y funcionalidad en tu escritorio\n• Etapa 8: Calidad y diseño para su equipo (Mochilas)\n... y sigue hasta la Etapa 13.", 'left');


// 5. TRANSICIONES DESDE EL INTERRUPTOR Central
// Graduación: Apagar Switch -> Encender (Prospección a Marketing)
drawConnector(118, 65, 110, 65, "", "solid", COLORS.switchOff); // Conector a Prospección
drawConnector(178, 86, 187, 86, "", "solid", COLORS.switchOn);  // Conector a Marketing

// Conectores Cruzados (Graduación/Degradación)
// A. De Prospección a Marketing (Graduación)
drawConnector(110, 120, 187, 120, "Confirmar Graduación (Pide Nombre y cambia etapa a 'marketing')", "solid", COLORS.switchOn);

// B. De Marketing a Prospección (Degradación)
drawConnector(187, 140, 110, 140, "Degradación / Reset (Confirma, congela marketing y reinicia etapa_envio = 1)", "dashed", COLORS.inactivo);


// 6. CAJA EXPLICATIVA INFERIOR (NOTAS TÉCNICAS)
doc.setFillColor(COLORS.slateLight[0], COLORS.slateLight[1], COLORS.slateLight[2]);
doc.rect(10, 156, 277, 44, 'F');
doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
doc.rect(10, 156, 277, 44, 'D');

doc.setFont('helvetica', 'bold');
doc.setFontSize(8.5);
doc.setTextColor(COLORS.bg[0], COLORS.bg[1], COLORS.bg[2]);
doc.text("NOTAS TÉCNICAS Y OPERACIONALES DEL FLUJO DE TRABAJO SIMPLIFICADO", 15, 161);

doc.setFont('helvetica', 'normal');
doc.setFontSize(7.5);
doc.setTextColor(51, 65, 85);
doc.text("• Interruptor de Campaña: Elimina el estado de pausa independiente. El interruptor define la campaña: Desactivado = Prospección, Activo = Marketing.", 15, 167);
doc.text("  Cuando está Desactivado (Gris), corre la secuencia fría. Cuando está Activo (Verde), corre la secuencia de nutrición.", 15, 171);

doc.text("• Comportamiento de Degradación: Al degradar un contacto, su etapa se cambia a 'prospeccion', su 'etapa_envio' se reinicia a 1 y su 'proximo_envio'", 15, 176);
doc.text("  se limpia para que el cron le envíe de inmediato el Ice-Breaker. El progreso de su campaña de marketing queda congelado sin alterarse.", 15, 180);

doc.text("• Reanudación de Marketing: Si el contacto responde positivamente en prospección y es el encargado correcto, al encender el interruptor,", 15, 185);
doc.text("  este se gradúa a Marketing y retoma la campaña de nutrición exactamente en la etapa que estaba previamente congelada.", 15, 189);

doc.text("• Contactos de la IA: Todo nuevo prospecto extraído por la IA comienza por defecto en Prospección y con el interruptor Desactivado.", 15, 194);
doc.text("  El cron diario comenzará su prospección de manera autónoma. Si el contacto no sirve o no desea recibir correos, se elimina del CRM.", 15, 198);


// Guardar documento
const pdfPath = 'c:/Users/Mario/Desktop/Replit/React-Vite-Starter/ecomoving_campanas_crm.pdf';
try {
  const output = doc.output('arraybuffer');
  fs.writeFileSync(pdfPath, Buffer.from(output));
  console.log(`✅ Diagrama guardado en PDF: ${pdfPath}`);
} catch (err) {
  console.error("Error al generar PDF:", err.message);
}
