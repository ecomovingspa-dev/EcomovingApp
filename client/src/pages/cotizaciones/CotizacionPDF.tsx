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
  variant?: "button" | "icon";
}

export const BotonExportarPDF: React.FC<BotonExportarPDFProps> = ({
  cotizacion,
  cuenta,
  contacto,
  items,
  totales,
  variant = "button",
}) => {
  const generarPDF = async () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 15;

      const logoUrl = "https://xgdmyjzyejjmwdqkufhp.supabase.co/storage/v1/object/public/logo_ecomoving/Logo.png";
      let logoImg: HTMLImageElement | null = null;

      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = logoUrl;
        });
        logoImg = img;
      } catch (e) {
        console.warn("Logo failed to load, using placeholder:", e);
      }

      // Função auxiliar para desenhar o header e footer em cada página
      const drawCommonElements = (doc: any, pageNumber: number) => {
        // Logo ou Título
        if (logoImg) {
          const logoHeight = 12;
          const logoWidth = (370 / 206) * logoHeight;
          doc.addImage(logoImg, "PNG", margin, 10, logoWidth, logoHeight);
        } else {
          doc.setTextColor(0, 150, 136);
          doc.setFontSize(18);
          doc.setFont("helvetica", "bold");
          doc.text("ECOMOVING SPA", margin, 20);
        }

        // Título de la cotización
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const nroCot = cotizacion.numero_cotizacion || "BORRADOR";
        doc.text(`Cotización: ${nroCot}`, pageWidth - margin, 15, { align: "right" });
        
        const fechaDoc = (cotizacion.fecha || cotizacion.created_at)
          ? new Date(cotizacion.fecha || cotizacion.created_at).toLocaleDateString("es-CL")
          : new Date().toLocaleDateString("es-CL");
        doc.text(`Fecha: ${fechaDoc}`, pageWidth - margin, 20, { align: "right" });

        // Removido bloque de marca de agua BORRADOR por petición del usuario


        // Footer
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);

        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text(
          "ECOMOVING SPA - www.ecomoving.cl - ventas@ecomoving.cl",
          pageWidth / 2,
          pageHeight - 12,
          { align: "center" }
        );
        doc.text(`Página ${pageNumber}`, pageWidth - margin, pageHeight - 12, { align: "right" });
      };

      // Header inicial da primeira página
      drawCommonElements(doc, 1);

      // INFORMACIÓN DEL CLIENTE
      let yPos = 35;
      const lineHeight = 6;
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.text("INFORMACIÓN DEL CLIENTE", margin, yPos);
      yPos += 5;
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 7;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      
      const col1 = margin;
      const col2 = margin + (pageWidth - 2 * margin) / 3;
      const col3 = margin + 2 * (pageWidth - 2 * margin) / 3;

      const vendNombre = cotizacion.vendedores?.nombre || cotizacion.vendedor_nombre || "Sin asignar";
      const vendCorreo = cotizacion.vendedores?.correo || cotizacion.vendedor_correo || "";
      const vendCel = cotizacion.vendedores?.celular || "";

      // FILA 1: Col 1: Cliente | Col 3: Vendedor
      doc.text(`Cliente: ${cuenta?.cliente || "No especificado"}`, col1, yPos);
      doc.text(`Vendedor: ${vendNombre}`, col3, yPos);
      yPos += lineHeight;

      // FILA 2: Col 1: Contacto | Col 3: Celular
      doc.text(`Contacto: ${contacto?.nombre || "No especificado"}`, col1, yPos);
      doc.text(`Celular: ${vendCel || "No especificado"}`, col3, yPos);
      yPos += lineHeight;

      // FILA 3: Col 1: Entrega | Col 2: Validez | Col 3: Correo
      doc.text(`Tiempo de entrega: ${cotizacion.tiempo_entrega || "No especificado"}`, col1, yPos);
      doc.text(`Validez: ${cotizacion.validez_oferta || "No especificado"}`, col2, yPos);
      doc.text(`Correo electrónico: ${vendCorreo || "No especificado"}`, col3, yPos);
      yPos += 10;

      // TABLA DE PRODUCTOS
      const tableData = items.map(item => {
        // Cálculo del costo total del item basado en sus subcostos
        const costoBaseItem = (item.subcostos || []).reduce((acc: number, sc: any) => {
          const valorSubCosto = (sc.cantidad || 0) * (sc.precio_unitario || 0) * (1 - (sc.descuento || 0) / 100);
          return acc + valorSubCosto;
        }, 0);

        // Cálculo del precio de venta (neto) aplicando el margen
        // precio_venta = costo / (1 - margen/100)
        const margen = item.margen || 0;
        const netoItem = costoBaseItem / (1 - margen / 100);
        
        // Precio unitario para el PDF: netoItem / cantidad
        const cantidad = item.cantidad || 1;
        const precioUnitario = netoItem / cantidad;

        return {
          descripcion: item.descripcion || "Sin descripción",
          cantidad: (item.cantidad || 0).toString(),
          precio: `$${Math.round(precioUnitario || 0).toLocaleString("es-CL")}`,
          subtotal: `$${Math.round(netoItem || 0).toLocaleString("es-CL")}`,
          imagen: item.imagen || null,
        };
      });

      autoTable(doc, {
        startY: yPos,
        head: [["", "Descripción", "Cant.", "Precio Unit.", "Subtotal"]],
        body: tableData.map(row => ["", row.descripcion, row.cantidad, row.precio, row.subtotal]),
        theme: "grid",
        headStyles: { fillColor: [0, 150, 136], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9, minCellHeight: 18, valign: "middle" },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 70 }, // Ajustado de 80 a 70 para no exceder márgenes (Total: 175mm < 180mm)
          2: { cellWidth: 15, halign: "center" },
          3: { cellWidth: 35, halign: "right" },
          4: { cellWidth: 35, halign: "right" }
        },
        margin: { left: margin, right: margin, top: 25 },
        didDrawPage: (data) => {
          // Si no es la primera página, dibujar elementos comunes
          if (data.pageNumber > 1) {
            drawCommonElements(doc, data.pageNumber);
          }
        },
        didDrawCell: (data) => {
          if (data.column.index === 0 && data.section === "body") {
            const item = tableData[data.row.index];
            if (item && item.imagen) {
              try {
                const format = item.imagen.includes("image/png") ? "PNG" : "JPEG";
                doc.addImage(item.imagen, format, data.cell.x + 2, data.cell.y + 2, 16, 14);
              } catch (e) {
                console.error("Image draw error:", e);
              }
            }
          }
        }
      });

      // SECCIÓN FINAL (TOTALES Y BANCO)
      const lastY = (doc as any).lastAutoTable?.finalY || yPos + 40;
      
      // Chequeo de espacio para el bloque final (aprox 60mm)
      if (lastY + 60 > pageHeight - 25) {
        doc.addPage();
        drawCommonElements(doc, doc.getNumberOfPages());
        yPos = 35;
      } else {
        yPos = lastY + 10;
      }

      // Línea divisora
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, yPos - 5, pageWidth - margin, yPos - 5);

      // Bloque de datos bancários y totales (2 colunas)
      const col2X = 110;
      
      // Col 1: Banco y Ecomoving
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("DATOS PARA TRANSFERENCIA", margin, yPos);
      doc.setFont("helvetica", "normal");
      doc.text("Banco BCI - Cuenta Corriente", margin, yPos + 5);
      doc.text("Nro: 13750780", margin, yPos + 9);
      doc.text("Ecomoving SPA - 77.567.348-6", margin, yPos + 13);
      doc.text("cobranza@ecomoving.cl", margin, yPos + 17);

      // Col 2: Totales
      doc.setFont("helvetica", "normal");
      doc.text("Subtotal Neto:", col2X, yPos);
      doc.text(`$${Math.round(totales?.neto || 0).toLocaleString("es-CL")}`, pageWidth - margin, yPos, { align: "right" });
      
      doc.text("IVA (19%):", col2X, yPos + 5);
      doc.text(`$${Math.round(totales?.iva || 0).toLocaleString("es-CL")}`, pageWidth - margin, yPos + 5, { align: "right" });
      
      doc.setLineWidth(0.5);
      doc.line(col2X, yPos + 8, pageWidth - margin, yPos + 8);
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL:", col2X, yPos + 14);
      doc.text(`$${Math.round(totales?.total || 0).toLocaleString("es-CL")}`, pageWidth - margin, yPos + 14, { align: "right" });

      // Guardar PDF
      const cleanCliente = (cuenta?.cliente || "Cliente").replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
      const cleanNumero = (cotizacion.numero_cotizacion || "BORRADOR").replace(/[^a-zA-Z0-9]/g, "_");
      doc.save(`Cotizacion_${cleanNumero}_${cleanCliente}.pdf`);
      
    } catch (err) {
      console.error("Fatal PDF Error:", err);
      alert("Error crítico al generar el PDF. Esto puede ocurrir por imágenes corruptas o falta de memoria en el navegador. Intente guardar la cotización primero.");
    }
  };

  if (variant === "icon") {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          generarPDF();
        }}
        className="p-1.5 hover:bg-white dark:hover:bg-gray-800 rounded-lg shadow-sm border border-transparent hover:border-blue-200 dark:hover:border-blue-900/50 transition-all group"
        title="Descargar PDF"
      >
        <FileDown className="h-4 w-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
      </button>
    );
  }

  return (
    <button
      onClick={generarPDF}
      className="inline-flex items-center gap-2 px-4 h-10 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800 hover:bg-slate-50 transition-all active:scale-95"
    >
      <FileDown className="h-4.5 w-4.5 text-blue-600" />
      Exportar PDF
    </button>
  );
};

export default BotonExportarPDF;
