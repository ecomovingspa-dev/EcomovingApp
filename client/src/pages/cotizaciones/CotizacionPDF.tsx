import React from "react";
import { FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface BotonExportarPDFProps {
  cotizacion: any;
  cuenta: any;
  contacto: any;
  items: any[];
  totales: any;
}

export const BotonExportarPDF: React.FC<BotonExportarPDFProps> = ({
  cotizacion,
  cuenta,
  contacto,
  items,
  totales,
}) => {
  const generarPDF = async () => {
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // HEADER
    const logoUrl =
      "https://xgdmyjzyejjmwdqkufhp.supabase.co/storage/v1/object/public/logo_ecomoving/Logo.png";

    try {
      const logoImg = new Image();
      logoImg.crossOrigin = "anonymous";

      await new Promise((resolve, reject) => {
        logoImg.onload = resolve;
        logoImg.onerror = reject;
        logoImg.src = logoUrl;
      });

      const logoHeight = 14.4;
      const logoWidth = (370 / 206) * logoHeight;
      doc.addImage(logoImg, "PNG", 15, 10, logoWidth, logoHeight);
    } catch (error) {
      doc.setTextColor(0, 150, 136);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("ECOMOVING", 15, 20);

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "normal");
      doc.text("SPA", 15, 25);
    }

    // Cotización y Fecha
    const cotizacionX = pageWidth - 60;
    const cotizacionY = 10;

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(
      "Cotización: " + (cotizacion.numero_cotizacion || "BORRADOR"),
      cotizacionX,
      cotizacionY,
    );

    const fechaCreacion = cotizacion.created_at
      ? new Date(cotizacion.created_at).toLocaleDateString("es-CL")
      : new Date().toLocaleDateString("es-CL");
    const fechaCotizacion = cotizacion.fecha
      ? new Date(cotizacion.fecha).toLocaleDateString("es-CL")
      : fechaCreacion;
    doc.text("Fecha: " + fechaCotizacion, cotizacionX, cotizacionY + 5);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, 35, pageWidth - 15, 35);

    // MARCA DE AGUA BORRADOR
    if (cotizacion.estado_cotizacion === "borrador") {
      doc.setTextColor(241, 245, 249);
      doc.setFontSize(60);
      doc.setFont("helvetica", "bold");
      doc.text("BORRADOR", pageWidth / 2, pageHeight / 2, {
        align: "center",
        angle: 45,
      });
    }

    // INFORMACIÓN DEL CLIENTE
    let yPos = 40;
    const lineHeight = 7;
    const fontSize = 10;

    const col1X = 15;
    const col2X = 80;
    const col3X = 145;

    doc.setFontSize(fontSize);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");

    // Fila 1: Cliente, Contacto
    const clienteText = `Cliente: ${cuenta?.cliente || "No especificado"}`;
    doc.text(clienteText, col1X, yPos);

    const contactoText = `Contacto: ${contacto?.nombre || "No especificado"}`;
    doc.text(contactoText, col3X, yPos);

    // Fila 2: Vendedor/a, Correo, Cel
    yPos += lineHeight;

    const vendedorText = `Vendedor/a: ${cotizacion.vendedor_nombre || "Sin asignar"}`;
    doc.text(vendedorText, col1X, yPos);

    if (cotizacion.vendedor_correo) {
      const correoText = `Correo: ${cotizacion.vendedor_correo}`;
      doc.text(correoText, col2X, yPos);
    }

    if (cotizacion.vendedor_celular) {
      const celText = `Cel: ${cotizacion.vendedor_celular}`;
      doc.text(celText, col3X, yPos);
    }

    // Fila 3: Tiempo de entrega, Validez
    yPos += lineHeight;

    const tiempoText = `Tiempo de entrega: ${cotizacion.tiempo_entrega || "No especificado"}`;
    doc.text(tiempoText, col1X, yPos);

    const validezText = `Validez: ${cotizacion.validez_oferta || "No especificado"}`;
    doc.text(validezText, col3X, yPos);

    // Línea separadora
    yPos += 6;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, yPos, pageWidth - 15, yPos);
    yPos += 5;

    // TABLA DE PRODUCTOS

    const tableData: any[] = [];

    for (const item of items) {
      const row: any = {
        descripcion: item.descripcion,
        cantidad: item.cantidad.toString(),
        precio: `$${Math.round(item.precio_unitario).toLocaleString("es-CL")}`,
        subtotal: `$${Math.round(item.subtotal).toLocaleString("es-CL")}`,
        imagen: item.imagen || null,
      };
      tableData.push(row);
    }

    autoTable(doc, {
      startY: yPos,
      head: [["", "Descripción", "Cant.", "Precio Unit.", "Subtotal"]],
      body: tableData.map((row) => [
        "",
        row.descripcion,
        row.cantidad,
        row.precio,
        row.subtotal,
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [0, 150, 136], // Color turquesa del logo Ecomoving
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
        halign: "left",
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [30, 41, 59],
        minCellHeight: 15,
        fillColor: [255, 255, 255], // Fondo blanco para todas las filas
      },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 75 },
        2: { cellWidth: 18, halign: "center" },
        3: { cellWidth: 32, halign: "right" },
        4: { cellWidth: 35, halign: "right" },
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255], // También blanco para filas alternas (sin alternancia)
      },
      margin: { left: 15, right: 15 },
      didDrawCell: (data) => {
        if (data.column.index === 0 && data.section === "body") {
          const item = tableData[data.row.index];
          if (item.imagen) {
            try {
              doc.addImage(
                item.imagen,
                "PNG",
                data.cell.x + 2,
                data.cell.y + 2,
                14,
                14,
              );
            } catch (e) {
              // Ignorar error de imagen
            }
          }
        }
      },
    });

    // Línea separadora antes de totales
    const finalY = (doc as any).lastAutoTable.finalY || yPos + 40;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, finalY + 5, pageWidth - 15, finalY + 5);

    // DATOS BANCARIOS, ECOMOVING Y TOTALES
    let totalesY = finalY + 10;
    const totalesCol1X = 15;
    const totalesCol2X = 80;
    const totalesCol3X = 145;
    const dataFontSize = 10;

    doc.setFontSize(dataFontSize);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");

    // Columna 1: Datos Bancarios
    doc.text("Datos Bancarios:", totalesCol1X, totalesY);
    totalesY += 5;
    doc.text("Banco BCI", totalesCol1X, totalesY);
    totalesY += 4;
    doc.text("Cuenta Corriente:", totalesCol1X, totalesY);
    totalesY += 4;
    doc.text("13750780", totalesCol1X, totalesY);
    totalesY += 4;
    doc.text("cobranza@ecomoving.cl", totalesCol1X, totalesY);

    // Columna 2: Ecomoving SPA
    totalesY = finalY + 10;
    doc.text("Ecomoving SPA", totalesCol2X, totalesY);
    totalesY += 4;
    doc.text("77.567.348-6", totalesCol2X, totalesY);
    totalesY += 4;
    doc.text("Servicios de Publicidad", totalesCol2X, totalesY);
    totalesY += 4;
    doc.text("Las Golondrinas 3761,", totalesCol2X, totalesY);
    totalesY += 4;
    doc.text("Macul", totalesCol2X, totalesY);

    // Columna 3: Totales
    totalesY = finalY + 10;
    doc.text("Subtotal:", totalesCol3X, totalesY);
    doc.text(
      `$${Math.round(totales.neto).toLocaleString("es-CL")}`,
      pageWidth - 15,
      totalesY,
      { align: "right" },
    );

    totalesY += 5;
    doc.text("IVA (19%):", totalesCol3X, totalesY);
    doc.text(
      `$${Math.round(totales.iva).toLocaleString("es-CL")}`,
      pageWidth - 15,
      totalesY,
      { align: "right" },
    );

    totalesY += 3;
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.5);
    doc.line(totalesCol3X, totalesY, pageWidth - 15, totalesY);

    totalesY += 5;
    doc.setFontSize(12);
    doc.text("TOTAL:", totalesCol3X, totalesY);
    doc.text(
      `$${Math.round(totales.total).toLocaleString("es-CL")}`,
      pageWidth - 15,
      totalesY,
      { align: "right" },
    );

    // FOOTER
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, pageHeight - 20, pageWidth - 15, pageHeight - 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(
      "ECOMOVING SPA - www.ecomoving.cl - ventas@ecomoving.cl",
      pageWidth / 2,
      pageHeight - 12,
      { align: "center" },
    );

    // GUARDAR PDF
    const nombreArchivo = `Cotizacion_${cotizacion.numero_cotizacion || "BORRADOR"}_${cuenta?.cliente?.replace(/\s+/g, "_") || "Cliente"}.pdf`;
    doc.save(nombreArchivo);
  };

  return (
    <button
      onClick={generarPDF}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors h-8"
    >
      <FileDown className="h-4 w-4" />
      PDF
    </button>
  );
};

export default BotonExportarPDF;
