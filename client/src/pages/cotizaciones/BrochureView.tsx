import { useRef, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Cotizacion } from "../../types";
import { Button } from "@/components/ui/button";
import { Download, ArrowLeft, Image as ImageIcon, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface BrochureViewProps {
    cotizacion: Partial<Cotizacion>;
    onBack?: () => void;
    orientation?: "portrait" | "landscape";
    pageSize?: "a4" | "carta";
    onUpdateItems?: (items: any[]) => void;
}

const BAR_COLORS = [
    { bg: "bg-[#b3d4a8]", text: "text-[#2d4a22]", line: "bg-[#2d4a22]/20" }, // Green
    { bg: "bg-indigo-200", text: "text-indigo-900", line: "bg-indigo-900/20" }, // Indigo
    { bg: "bg-amber-200", text: "text-amber-900", line: "bg-amber-900/20" }, // Amber
    { bg: "bg-rose-100", text: "text-rose-900", line: "bg-rose-900/20" }, // Rose
    { bg: "bg-slate-200", text: "text-slate-900", line: "bg-slate-900/20" }  // Slate
];

export default function BrochureView({
    cotizacion,
    onBack,
    orientation = "portrait",
    pageSize = "carta",
    onUpdateItems
}: BrochureViewProps) {
    const navigate = useNavigate();
    const brochureRef = useRef<HTMLDivElement>(null);
    const [injectedPages, setInjectedPages] = useState<any[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [exporting, setExporting] = useState(false);

    const items = cotizacion.items || [];

    useEffect(() => {
        if (cotizacion.items && cotizacion.items.length > 0) {
            loadMagicTemplates();
        }
    }, [cotizacion.id]);

    const loadMagicTemplates = async () => {
        try {
            setLoadingTemplates(true);
            const detectedCategories = new Set<string>();
            
            const keywords = ["BOTELLA", "MUG", "BOLIGRAFO", "BOLSA", "TECNOLOGIA", "TEXTIL", "LIBRETA", "MOCHILA"];

            items.forEach(item => {
                if (item.categoria_producto) {
                    detectedCategories.add(item.categoria_producto.toUpperCase());
                } else {
                    const desc = item.descripcion.toUpperCase();
                    keywords.forEach(kw => {
                        if (desc.includes(kw)) detectedCategories.add(kw);
                    });
                }
            });

            if (detectedCategories.size === 0) return;

            const { data: files } = await supabase.storage.from('imagenes-marketing').list('templates');
            if (!files) return;

            const matchingFiles = files.filter(f => {
                const cat = f.name.split('_')[0].toUpperCase();
                return Array.from(detectedCategories).some(dc => cat.includes(dc) || dc.includes(cat));
            });

            const templates = await Promise.all(matchingFiles.map(async (f) => {
                const { data } = await supabase.storage.from('imagenes-marketing').download(`templates/${f.name}`);
                if (data) {
                    const text = await data.text();
                    const templateData = JSON.parse(text);
                    templateData.items = templateData.items.map((it: any) => ({ 
                        ...it, 
                        id: it.id || Math.random().toString(36).substr(2, 9), 
                        isInjected: true 
                    }));
                    return templateData;
                }
                return null;
            }));

            setInjectedPages(templates.filter(t => t !== null));
        } catch (err) {
            console.error("Error loading magic templates:", err);
        } finally {
            setLoadingTemplates(false);
        }
    };

    const dimensions = {
        width: orientation === "landscape"
            ? (pageSize === "carta" ? "270mm" : "297mm")
            : (pageSize === "carta" ? "210mm" : "210mm"),
        height: orientation === "landscape"
            ? (pageSize === "carta" ? "210mm" : "210mm")
            : (pageSize === "carta" ? "270mm" : "297mm")
    };

    const generarPDF = async () => {
        if (!brochureRef.current) return;
        try {
            setExporting(true);
            const orientation_pdf = orientation === "landscape" ? "l" : "p";
            const format = pageSize === "carta" ? "letter" : "a4";
            const pdf = new jsPDF(orientation_pdf, "mm", format);
            const pageElements = brochureRef.current.querySelectorAll('.brochure-page');

            for (let i = 0; i < pageElements.length; i++) {
                const element = pageElements[i] as HTMLElement;
                const controls = element.querySelectorAll('.no-print');
                controls.forEach(c => (c as HTMLElement).style.display = 'none');

                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: "#ffffff"
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();

                if (i > 0) pdf.addPage(format, orientation_pdf);
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                controls.forEach(c => (c as HTMLElement).style.display = '');
            }
            pdf.save(`Propuesta_Premium_${cotizacion.numero_cotizacion || 'Ecomoving'}.pdf`);
        } catch (err) {
            console.error(err);
            alert("Error al generar el PDF.");
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="min-h-screen bg-stone-900 text-white p-8 font-sans overflow-y-auto">
            {/* Toolbar */}
            <div className="mb-8 flex justify-between items-center no-print border-b border-white/10 pb-4 max-w-[1200px] mx-auto">
                <div className="flex items-center gap-6">
                    <Button variant="ghost" onClick={onBack || (() => navigate(-1))} className="text-white hover:bg-neutral-800 font-bold">
                        <ArrowLeft className="mr-2 h-4 w-4" /> PANEL DE DATOS
                    </Button>
                    <div className="text-[10px] font-black tracking-widest text-[#b3d4a8] uppercase border border-[#b3d4a8]/30 px-3 py-1 rounded-full bg-[#b3d4a8]/5">
                        GENERADOR DE PROPUESTA TÉCNICA PREMIUM
                    </div>
                </div>
                <div className="flex items-center gap-4">
                  {loadingTemplates && <div className="flex items-center gap-2 text-[10px] font-bold text-[#b3d4a8] animate-pulse"><Loader2 className="h-3 w-3 animate-spin"/> CARGANDO GALERÍAS...</div>}
                  <Button onClick={generarPDF} disabled={exporting} className="bg-[#2d4a22] text-[#b3d4a8] hover:bg-[#1a2e15] font-black px-8">
                      {exporting ? <Loader2 className="animate-spin" /> : <><Download className="mr-2 h-4 w-4" /> EXPORTAR PDF DE VENTA</>}
                  </Button>
                </div>
            </div>

            <div ref={brochureRef} className="flex flex-col gap-16 items-center pb-32">
                
                {/* 1. PORTADA CORPORATIVA */}
                <div 
                    className="bg-white text-neutral-900 shadow-2xl brochure-page relative overflow-hidden flex flex-col items-center justify-center p-20"
                    style={{ width: dimensions.width, height: dimensions.height, minHeight: dimensions.height }}
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#b3d4a8]/20 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#2d4a22]/10 rounded-full -ml-40 -mb-40 blur-3xl"></div>
                    
                    <img 
                        src="https://xgdmyjzyejjmwdqkufhp.supabase.co/storage/v1/object/public/logo_ecomoving/Logo_horizontal.png" 
                        className="w-80 object-contain mb-12" 
                        alt="Ecomoving" 
                    />
                    
                    <div className="w-1/2 h-1 bg-[#2d4a22] mb-12 opacity-80"></div>
                    
                    <h1 className="text-5xl font-black tracking-tighter text-neutral-900 text-center uppercase mb-4">
                        Propuesta Técnica <br/> y Comercial
                    </h1>
                    
                    <div className="text-3xl font-serif italic text-[#2d4a22] opacity-80 mb-20">
                        Contemos tu Historia
                    </div>
                    
                    <div className="mt-auto border-t border-neutral-100 pt-8 w-full flex justify-between items-end">
                        <div className="space-y-1">
                           <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Preparado para:</p>
                           <p className="text-lg font-bold text-neutral-800 uppercase">{cotizacion.cuenta?.cliente || 'Cliente Corporativo'}</p>
                           <p className="text-sm font-medium text-neutral-500">{cotizacion.contacto?.nombre || ''}</p>
                        </div>
                        <div className="text-right space-y-1">
                           <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Documento ID:</p>
                           <p className="text-lg font-black text-[#2d4a22]">{cotizacion.numero_cotizacion || 'COT-PRO-01'}</p>
                           <p className="text-sm font-bold text-neutral-400">{new Date().toLocaleDateString('es-CL')}</p>
                        </div>
                    </div>
                </div>

                {/* 2. PÁGINAS DE ÍTEMS */}
                {items.map((item, idx) => {
                    const color = BAR_COLORS[idx % BAR_COLORS.length];
                    const imgs = item.imagenes_secundarias || ["", "", ""];

                    return (
                        <div
                            key={`item-page-${item.id}`}
                            className="bg-white text-neutral-900 shadow-2xl brochure-page flex flex-row relative overflow-hidden"
                            style={{ width: dimensions.width, height: dimensions.height, minHeight: dimensions.height }}
                        >
                            <div className={`w-24 ${color.bg} flex flex-col py-12 items-center justify-between shrink-0`}>
                                <div className="transform -rotate-90 w-48 h-12 flex items-center justify-center mt-32 origin-center">
                                    <img src="https://xgdmyjzyejjmwdqkufhp.supabase.co/storage/v1/object/public/logo_ecomoving/Logo_horizontal.png" className="w-full filter brightness-0 invert opacity-60" alt="" />
                                </div>
                                <div className="text-[10px] font-black text-white/40 tracking-[0.3em] rotate-90 pb-20 uppercase font-mono tracking-widest">Item {idx + 1}</div>
                            </div>

                            <div className="flex-1 p-16 flex flex-col">
                                <h2 className="text-3xl font-black text-neutral-900 uppercase border-b-4 border-[#b3d4a8] pb-4 mb-8 tracking-tight">
                                    {item.descripcion}
                                </h2>

                                <div className="grid grid-cols-12 gap-10 flex-1 overflow-hidden">
                                    <div className="col-span-12 lg:col-span-5 space-y-8 flex flex-col">
                                        <div className="p-8 bg-neutral-50 rounded-[2.5rem] border border-neutral-100 flex-1 flex items-center">
                                            <p className="text-lg font-medium leading-[1.6] text-neutral-700 italic">
                                                {item.especificaciones_tecnicas || "Nuestra propuesta incluye personalización de alta gama bajo estándares técnicos internacionales, garantizando durabilidad y presencia de marca excepcional."}
                                            </p>
                                        </div>
                                        
                                        <div className="aspect-square bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border-[12px] border-white group relative">
                                            {item.imagen ? (
                                                <img src={item.imagen} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                <div className="flex items-center justify-center h-full bg-neutral-100 font-black text-neutral-300">MINIATURA</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="col-span-12 lg:col-span-7 grid grid-rows-3 gap-6">
                                        {imgs.map((img, i) => (
                                            <div key={i} className={`rounded-[2.5rem] shadow-xl overflow-hidden border-4 border-neutral-50 flex items-center justify-center ${i === 0 ? 'bg-[#b3d4a8]/10' : 'bg-neutral-100/50'}`}>
                                                {img ? (
                                                    <img src={img} className="w-full h-full object-cover" alt="" />
                                                ) : (
                                                    <ImageIcon className="h-10 w-10 text-neutral-200" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* 3. GALERÍAS DINÁMICAS */}
                {injectedPages.map((template, tIdx) => (
                    <div
                        key={`template-${tIdx}`}
                        className="bg-white text-neutral-900 shadow-2xl brochure-page relative overflow-hidden"
                        style={{ width: dimensions.width, height: dimensions.height, minHeight: dimensions.height }}
                    >
                        <div className="p-16 h-full flex flex-col">
                            <div className="flex items-center gap-6 mb-12 border-b-2 border-neutral-100 pb-6">
                                <img src="https://xgdmyjzyejjmwdqkufhp.supabase.co/storage/v1/object/public/logo_ecomoving/Logo_horizontal.png" className="h-10" alt="" />
                                <div className="h-8 w-px bg-neutral-200"></div>
                                <h3 className="text-2xl font-black uppercase tracking-[0.2em] text-[#2d4a22]">Galería de Proyectos</h3>
                            </div>

                            <div className="flex-1">
                                {template.layoutMode === "structural" ? (
                                    <div className="grid h-full gap-6" style={{ gridTemplateColumns: `repeat(${template.cols}, 1fr)`, gridTemplateRows: `repeat(${template.rows}, 1fr)` }}>
                                        {template.items.map((it: any, iIdx: number) => (
                                            <div key={iIdx} className="relative overflow-hidden rounded-[2rem] shadow-lg">
                                                <img src={it.imagen} className="w-full h-full object-cover" alt="" />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="w-full h-full relative">
                                        {template.items.map((it: any, iIdx: number) => (
                                            <div key={iIdx} className="absolute overflow-hidden rounded-[1.5rem] shadow-xl border-8 border-white" style={{ width: it.w, height: it.h, left: it.x, top: it.y, zIndex: it.zIndex }}>
                                                <img src={it.imagen} className="w-full h-full object-cover" alt="" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="absolute bottom-0 right-0 w-40 h-40 bg-[#b3d4a8] rounded-tl-[5rem] flex items-center justify-center">
                            <div className="font-serif italic text-3xl text-[#2d4a22] -rotate-12 pb-4 pr-4">Ecomoving</div>
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
                @page { size: ${dimensions.width} ${dimensions.height}; margin: 0; }
                @media print {
                    .no-print { display: none !important; }
                    .brochure-page { box-shadow: none !important; margin: 0 !important; page-break-after: always; }
                }
            `}</style>
        </div>
    );
}
