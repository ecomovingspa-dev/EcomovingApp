import { useRef, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Cotizacion } from "../../types";
import { Button } from "@/components/ui/button";
import { Download, Share2, ArrowLeft, MousePointer2, LayoutGrid, Layers, ChevronUp, ChevronDown, Move, ZoomIn, Copy, Type, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Rnd } from "react-rnd";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface BrochureViewProps {
    cotizacion: Partial<Cotizacion>;
    onBack?: () => void;
    rows: number;
    cols: number;
    layoutMode: "structural" | "free";
    orientation?: "portrait" | "landscape";
    pageSize?: "a4" | "carta";
    onUpdateItems?: (items: any[]) => void;
}

interface BrochureItem {
    id: string | number;
    imagen?: string;
    descripcion?: string;
    type?: "image" | "text";
    content?: string;
    fitMode?: "cover" | "contain";
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    zIndex?: number;
    scale?: number;
    shiftX?: number;
    shiftY?: number;
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
    rows = 2,
    cols = 2,
    layoutMode = "structural",
    orientation = "portrait",
    pageSize = "carta",
    onUpdateItems
}: BrochureViewProps) {
    const navigate = useNavigate();
    const brochureRef = useRef<HTMLDivElement>(null);
    const [injectedPages, setInjectedPages] = useState<any[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [activeItemId, setActiveItemId] = useState<string | number | null>(null);
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
                const desc = item.descripcion.toUpperCase();
                keywords.forEach(kw => {
                    if (desc.includes(kw)) detectedCategories.add(kw);
                });
            });

            if (detectedCategories.size === 0) return;

            const { data: files } = await supabase.storage.from('imagenes-marketing').list('templates');
            if (!files) return;

            const matchingFiles = files.filter(f => {
                const cat = f.name.split('_')[0].toUpperCase();
                return detectedCategories.has(cat);
            });

            const templates = await Promise.all(matchingFiles.map(async (f) => {
                const { data } = await supabase.storage.from('imagenes-marketing').download(`templates/${f.name}`);
                if (data) {
                    const text = await data.text();
                    const templateData = JSON.parse(text);
                    // Ensure unique IDs for items in injected pages to avoid collisions with cotizacion items
                    templateData.items = templateData.items.map((it: any) => ({ ...it, id: it.id || Math.random().toString(36).substr(2, 9), isInjected: true }));
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

    // Pagination Logic for Structural Mode
    const itemsPerPage = rows * cols;
    const numPages = layoutMode === "structural" ? Math.ceil(items.length / itemsPerPage) : 1;
    const pages = [];

    if (layoutMode === "structural") {
        for (let i = 0; i < items.length; i += itemsPerPage) {
            pages.push(items.slice(i, i + itemsPerPage));
        }
    } else {
        // In Free Mode, everything is on Page 1 for now (prototype)
        pages.push(items);
    }

    const dimensions = {
        width: orientation === "landscape"
            ? (pageSize === "carta" ? "270mm" : "297mm")
            : (pageSize === "carta" ? "210mm" : "210mm"),
        height: orientation === "landscape"
            ? (pageSize === "carta" ? "210mm" : "210mm")
            : (pageSize === "carta" ? "270mm" : "297mm")
    };

    const handleUpdateItem = (id: string | number, updates: any) => {
        // 1. Try updating standard quotation items
        const itemInQuotation = items.find(it => it.id.toString() === id.toString());
        if (itemInQuotation && onUpdateItems) {
            const newItems = items.map(item =>
                item.id.toString() === id.toString() ? { ...item, ...updates } : item
            );
            onUpdateItems(newItems);
            return;
        }

        // 2. Try updating items in injected pages (local state)
        let foundInInjected = false;
        const newInjectedPages = injectedPages.map(page => {
            if (page.items.find((it: any) => it.id.toString() === id.toString())) {
                foundInInjected = true;
                return {
                    ...page,
                    items: page.items.map((it: any) =>
                        it.id.toString() === id.toString() ? { ...it, ...updates } : it
                    )
                };
            }
            return page;
        });

        if (foundInInjected) {
            setInjectedPages(newInjectedPages);
        }
    };

    // Keyboard movement listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!activeItemId) return;

            // Don't move if typing in an input
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

            const step = e.shiftKey ? 10 : 1;
            const item = [...items, ...injectedPages.flatMap(p => p.items)].find(it => it.id.toString() === activeItemId.toString());

            if (!item) return;

            if (e.key === 'ArrowUp') { e.preventDefault(); handleUpdateItem(activeItemId, { y: (item.y || 0) - step }); }
            if (e.key === 'ArrowDown') { e.preventDefault(); handleUpdateItem(activeItemId, { y: (item.y || 0) + step }); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); handleUpdateItem(activeItemId, { x: (item.x || 0) - step }); }
            if (e.key === 'ArrowRight') { e.preventDefault(); handleUpdateItem(activeItemId, { x: (item.x || 0) + step }); }
            if (e.key === 'Delete') {
                if (window.confirm('¿Eliminar este elemento del diseño?')) {
                    // Filter out from whichever list it belongs to
                    if (onUpdateItems) onUpdateItems(items.filter(it => it.id !== activeItemId));
                    setInjectedPages(injectedPages.map(p => ({ ...p, items: p.items.filter((it: any) => it.id !== activeItemId) })));
                    setActiveItemId(null);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeItemId, items, injectedPages]);

    const generarPDF = async () => {
        if (!brochureRef.current) return;

        try {
            setExporting(true);
            const orientation_pdf = orientation === "landscape" ? "l" : "p";
            const unit = "mm";
            const format = pageSize === "carta" ? "letter" : "a4";

            const pdf = new jsPDF(orientation_pdf, unit, format);
            const pageElements = brochureRef.current.querySelectorAll('.brochure-page');

            for (let i = 0; i < pageElements.length; i++) {
                const element = pageElements[i] as HTMLElement;

                // Hide controls during capture
                const controls = element.querySelectorAll('.no-print');
                controls.forEach(c => (c as HTMLElement).style.display = 'none');

                const canvas = await html2canvas(element, {
                    scale: 2, // Higher quality
                    useCORS: true,
                    logging: false,
                    backgroundColor: "#ffffff"
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();

                if (i > 0) pdf.addPage(format, orientation_pdf);
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

                // Restore controls
                controls.forEach(c => (c as HTMLElement).style.display = '');
            }

            const fileName = `Brochure_${cotizacion.numero_cotizacion || 'Ecomoving'}.pdf`;
            pdf.save(fileName);
        } catch (err) {
            console.error("Error generando PDF:", err);
            alert("Error al generar el PDF.");
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-900 text-white p-8 font-sans overflow-y-auto">
            {/* Controls */}
            <div className="mb-8 flex justify-between items-center no-print border-b border-white/10 pb-4 max-w-[1200px] mx-auto">
                <div className="flex items-center gap-6">
                    <Button
                        variant="ghost"
                        onClick={onBack || (() => navigate(-1))}
                        className="text-white hover:bg-neutral-800 font-bold"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Volver a edición
                    </Button>
                    <div className="flex items-center gap-2 bg-neutral-800/50 px-3 py-1.5 rounded-full border border-white/5">
                        {layoutMode === "free" ? (
                            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                                <MousePointer2 className="h-3 w-3" /> MODO LIENZO LIBRE ACTIVO
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold">
                                <LayoutGrid className="h-3 w-3" /> MODO ESTRUCTURAL ACTIVO
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex gap-4">
                    <Button variant="outline" className="text-white border-neutral-700 hover:bg-neutral-800 font-bold">
                        <Share2 className="mr-2 h-4 w-4" /> Compartir
                    </Button>
                    <Button
                        onClick={generarPDF}
                        disabled={exporting}
                        className="bg-white text-black hover:bg-gray-200 font-bold"
                    >
                        {exporting ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando...</>
                        ) : (
                            <><Download className="mr-2 h-4 w-4" /> Exportar Mural ({pages.length + injectedPages.length} {pages.length + injectedPages.length === 1 ? 'Pág' : 'Págs'})</>
                        )}
                    </Button>
                </div>
            </div>

            <div ref={brochureRef} className="flex flex-col gap-16 items-center pb-32">
                {/* 1. Injected Magic Pages */}
                {injectedPages.map((template, tIdx) => {
                    const color = BAR_COLORS[tIdx % BAR_COLORS.length];
                    const isEven = tIdx % 2 === 0;

                    return (
                        <div
                            key={`template-${tIdx}`}
                            className="bg-white text-neutral-900 shadow-2xl overflow-hidden flex flex-row brochure-page print:shadow-none print:m-0 relative"
                            style={{
                                width: dimensions.width,
                                height: dimensions.height,
                                minHeight: dimensions.height,
                            }}
                        >
                            {/* Branding Bar */}
                            {isEven && (
                                <div className={`w-16 md:w-28 ${color.bg} flex flex-col py-12 items-center justify-between relative overflow-hidden shrink-0 z-10`}>
                                    <div className="transform -rotate-90 w-48 h-12 flex items-center justify-center mt-32 origin-center">
                                        <img
                                            src="https://xgdmyjzyejjmwdqkufhp.supabase.co/storage/v1/object/public/logo_ecomoving/Logo_horizontal.png"
                                            className="max-w-full max-h-full object-contain filter brightness-0 invert opacity-80"
                                            alt="Ecomoving"
                                        />
                                    </div>
                                    <div className={`w-1 h-32 mb-12 ${color.line}`}></div>
                                </div>
                            )}

                            <div className="flex-1 relative overflow-hidden bg-white">
                                {template.layoutMode === "structural" ? (
                                    <div
                                        className="grid h-full w-full"
                                        style={{
                                            gridTemplateColumns: `repeat(${template.cols}, 1fr)`,
                                            gridTemplateRows: `repeat(${template.rows}, 1fr)`
                                        }}
                                    >
                                        {template.items.map((item: any, iIdx: number) => (
                                            <div key={iIdx} className={`relative overflow-hidden ${item.fitMode === 'contain' ? 'bg-white' : 'bg-neutral-50'}`}>
                                                <img src={item.imagen} className={`w-full h-full ${item.fitMode === 'contain' ? 'object-contain p-4' : 'object-cover'}`} alt="" />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="w-full h-full relative">
                                        {template.items.map((item: any, iIdx: number) => (
                                            <Rnd
                                                key={item.id || iIdx}
                                                size={{ width: item.w || 200, height: item.h || 200 }}
                                                position={{ x: item.x || 50, y: item.y || 50 }}
                                                style={{ zIndex: item.zIndex || 0 }}
                                                bounds="parent"
                                                onDragStop={(e, d) => handleUpdateItem(item.id, { x: d.x, y: d.y })}
                                                onResizeStop={(e, dir, ref, delta, pos) => handleUpdateItem(item.id, { w: ref.offsetWidth, h: ref.offsetHeight, ...pos })}
                                                onDragStart={() => setActiveItemId(item.id)}
                                                className="group"
                                            >
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); setActiveItemId(item.id); }}
                                                    className={`w-full h-full border-2 ${activeItemId?.toString() === item.id.toString() ? 'border-amber-500 shadow-lg' : 'border-transparent'} hover:border-amber-400 group-hover:shadow-md transition-all cursor-move relative overflow-hidden bg-white`}
                                                >
                                                    <img
                                                        src={item.imagen}
                                                        className={`w-full h-full pointer-events-none transition-transform ${item.fitMode === 'contain' ? 'object-contain p-4' : 'object-cover'}`}
                                                        style={{ transform: `scale(${item.scale || 1}) translate(${item.shiftX || 0}px, ${item.shiftY || 0}px)` }}
                                                        alt=""
                                                    />

                                                    {/* Injected controls for z-index too */}
                                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-20 no-print">
                                                        <Button
                                                            variant="secondary" size="icon" className="h-7 w-7 bg-white/90 shadow-sm"
                                                            onClick={(e) => { e.stopPropagation(); handleUpdateItem(item.id, { zIndex: (item.zIndex || 0) + 10 }); }}
                                                            title="Traer al frente"
                                                        >
                                                            <ChevronUp className="h-3.5 w-3.5 text-indigo-600" />
                                                        </Button>
                                                        <Button
                                                            variant="secondary" size="icon" className="h-7 w-7 bg-white/90 shadow-sm"
                                                            onClick={(e) => { e.stopPropagation(); handleUpdateItem(item.id, { zIndex: Math.max(0, (item.zIndex || 0) - 10) }); }}
                                                            title="Enviar al fondo"
                                                        >
                                                            <ChevronDown className="h-3.5 w-3.5 text-indigo-600" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </Rnd>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {!isEven && (
                                <div className={`w-16 md:w-28 ${color.bg} flex flex-col py-12 items-center justify-between relative overflow-hidden shrink-0 z-10`}>
                                    <div className="transform rotate-90 w-48 h-12 flex items-center justify-center mb-32 origin-center">
                                        <img
                                            src="https://xgdmyjzyejjmwdqkufhp.supabase.co/storage/v1/object/public/logo_ecomoving/Logo_horizontal.png"
                                            className="max-w-full max-h-full object-contain filter brightness-0 invert opacity-80"
                                            alt="Ecomoving"
                                        />
                                    </div>
                                    <div className={`w-1 h-32 mt-12 ${color.line}`}></div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* 2. Quotation Item Pages */}
                {pages.map((pageItems, pageIdx) => {
                    const color = BAR_COLORS[(pageIdx + injectedPages.length) % BAR_COLORS.length];
                    const isEven = (pageIdx + injectedPages.length) % 2 === 0;

                    return (
                        <div
                            key={pageIdx}
                            className={`bg-white text-neutral-900 shadow-2xl overflow-hidden flex flex-row brochure-page print:shadow-none print:m-0 relative`}
                            style={{
                                width: dimensions.width,
                                height: dimensions.height,
                                minHeight: dimensions.height,
                            }}
                        >
                            {/* Branding Bar (Left Case) */}
                            {isEven && (
                                <div className={`w-16 md:w-28 ${color.bg} flex flex-col py-12 items-center justify-between relative overflow-hidden shrink-0 transition-colors duration-1000 z-10`}>
                                    <div className="transform -rotate-90 w-48 h-12 flex items-center justify-center mt-32 origin-center">
                                        <img
                                            src="https://xgdmyjzyejjmwdqkufhp.supabase.co/storage/v1/object/public/logo_ecomoving/Logo_horizontal.png"
                                            className="max-w-full max-h-full object-contain filter brightness-0 invert opacity-80"
                                            alt="Ecomoving"
                                        />
                                    </div>
                                    <div className={`w-1 h-32 mb-12 ${color.line}`}></div>
                                </div>
                            )}

                            {/* Canvas Area */}
                            <div className="flex-1 overflow-hidden bg-white relative">
                                {layoutMode === "structural" ? (
                                    <div
                                        className="grid h-full w-full gap-0"
                                        style={{
                                            gridTemplateColumns: `repeat(${cols}, 1fr)`,
                                            gridTemplateRows: `repeat(${rows}, 1fr)`
                                        }}
                                    >
                                        {pageItems.map((item: any, idx) => (
                                            <div
                                                key={item.id || idx}
                                                className={`relative overflow-hidden group border-[0.5px] border-neutral-100 ${item.fitMode === "contain" ? "bg-white" : "bg-neutral-50"
                                                    }`}
                                            >
                                                {item.imagen && (
                                                    <div className="absolute inset-0 flex flex-col">
                                                        <div className="flex-1 overflow-hidden">
                                                            <img
                                                                src={item.imagen}
                                                                alt=""
                                                                className={`w-full h-full transition-all duration-[3s] ease-in-out ${item.fitMode === "contain"
                                                                    ? "object-contain p-6"
                                                                    : "object-cover group-hover:scale-105"
                                                                    }`}
                                                            />
                                                        </div>
                                                        <div className="bg-white/90 backdrop-blur-sm p-2 border-t border-neutral-100">
                                                            <p className="text-[10px] font-bold text-neutral-800 line-clamp-2 uppercase leading-tight">
                                                                {item.descripcion}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        {/* Fill empty slots in the matrix if any */}
                                        {Array.from({ length: Math.max(0, itemsPerPage - pageItems.length) }).map((_, i) => (
                                            <div key={`empty-${i}`} className="bg-neutral-50 border-[0.5px] border-neutral-100"></div>
                                        ))}
                                    </div>
                                ) : (
                                    /* FREE CANVAS MODE */
                                    <div className="w-full h-full bg-white relative overflow-hidden">
                                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                                            style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                                        {(pageItems as BrochureItem[]).map((item: BrochureItem) => (
                                            <Rnd
                                                key={item.id}
                                                size={{ width: item.w || 200, height: item.h || 200 }}
                                                position={{ x: item.x || 50, y: item.y || 50 }}
                                                style={{ zIndex: item.zIndex || 0 }}
                                                bounds="parent"
                                                onDragStart={() => setActiveItemId(item.id)}
                                                onDragStop={(e, d) => handleUpdateItem(item.id, { x: d.x, y: d.y })}
                                                onResizeStop={(e, direction, ref, delta, position) => {
                                                    handleUpdateItem(item.id, {
                                                        w: ref.offsetWidth,
                                                        h: ref.offsetHeight,
                                                        ...position,
                                                    });
                                                }}
                                                className="group"
                                            >
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); setActiveItemId(item.id); }}
                                                    className={`w-full h-full border-2 ${activeItemId?.toString() === item.id.toString() ? 'border-amber-500 shadow-xl' : 'border-transparent'} hover:border-amber-400 group-hover:shadow-md transition-all cursor-move relative overflow-hidden ${item.fitMode === 'contain' ? 'bg-white' : ''}`}
                                                >
                                                    {item.type === 'text' ? (
                                                        <div className="w-full h-full p-4 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                                                            <p className="text-sm font-bold text-neutral-800 text-center uppercase tracking-tight">
                                                                {item.content}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <img
                                                            src={item.imagen}
                                                            alt=""
                                                            className={`w-full h-full pointer-events-none transition-transform ${item.fitMode === 'contain' ? 'object-contain p-4' : 'object-cover'}`}
                                                            style={{
                                                                transform: `scale(${item.scale || 1}) translate(${item.shiftX || 0}px, ${item.shiftY || 0}px)`,
                                                            }}
                                                        />
                                                    )}

                                                    {/* Pro Controls Overlay */}
                                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-20 no-print">
                                                        <Button
                                                            variant="secondary" size="icon" className="h-7 w-7 bg-white/90 shadow-sm"
                                                            onClick={(e) => { e.stopPropagation(); handleUpdateItem(item.id, { zIndex: (item.zIndex || 0) + 10 }); }}
                                                            title="Traer al frente"
                                                        >
                                                            <ChevronUp className="h-3.5 w-3.5 text-indigo-600" />
                                                        </Button>
                                                        <Button
                                                            variant="secondary" size="icon" className="h-7 w-7 bg-white/90 shadow-sm"
                                                            onClick={(e) => { e.stopPropagation(); handleUpdateItem(item.id, { zIndex: Math.max(0, (item.zIndex || 0) - 10) }); }}
                                                            title="Enviar al fondo"
                                                        >
                                                            <ChevronDown className="h-3.5 w-3.5 text-indigo-600" />
                                                        </Button>
                                                        <div className="h-px w-full bg-neutral-200 my-1"></div>
                                                        <Button
                                                            variant="secondary" size="icon" className="h-7 w-7 bg-white/90 shadow-sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const newItem = { ...item, id: Math.random().toString(36).substr(2, 9), x: (item.x || 0) + 20, y: (item.y || 0) + 20 };
                                                                if (onUpdateItems) onUpdateItems([...pageItems, newItem]);
                                                            }}
                                                            title="Duplicar (Copy/Paste)"
                                                        >
                                                            <Copy className="h-3.5 w-3.5 text-blue-600" />
                                                        </Button>
                                                        <Button
                                                            variant="secondary" size="icon" className="h-7 w-7 bg-white/90 shadow-sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const newTextItem: BrochureItem = {
                                                                    id: Math.random().toString(36).substr(2, 9),
                                                                    type: 'text',
                                                                    content: item.descripcion || 'Descripción del ítem',
                                                                    x: (item.x || 0) + (item.w || 200) + 10,
                                                                    y: (item.y || 0),
                                                                    w: 150,
                                                                    h: 50,
                                                                    zIndex: (item.zIndex || 0) + 1,
                                                                };
                                                                if (onUpdateItems) onUpdateItems([...pageItems, newTextItem]);
                                                            }}
                                                            title="Añadir Etiqueta de Descripción"
                                                        >
                                                            <Type className="h-3.5 w-3.5 text-purple-600" />
                                                        </Button>
                                                        <div className="h-px w-full bg-neutral-200 my-1"></div>
                                                        <Button
                                                            variant="secondary" size="icon" className="h-7 w-7 bg-white/90 shadow-sm"
                                                            onClick={(e) => { e.stopPropagation(); handleUpdateItem(item.id, { scale: (item.scale || 1) + 0.1 }); }}
                                                            title="Aumentar Zoom / Recorte"
                                                        >
                                                            <ZoomIn className="h-3.5 w-3.5 text-amber-600" />
                                                        </Button>
                                                        <Button
                                                            variant="secondary" size="icon" className="h-7 w-7 bg-white/90 shadow-sm"
                                                            onClick={(e) => { e.stopPropagation(); handleUpdateItem(item.id, { scale: Math.max(1, (item.scale || 1) - 0.1) }); }}
                                                            title="Reducir Zoom"
                                                        >
                                                            <div className="text-[10px] font-bold text-amber-600">-</div>
                                                        </Button>
                                                    </div>

                                                    {/* Pan Controls (Visual Hint) */}
                                                    {item.scale && item.scale > 1 && (
                                                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                                            <div className="flex bg-black/60 backdrop-blur-md rounded-lg p-1 border border-white/20 gap-1 items-center">
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-white p-0 hover:bg-white/10" onClick={() => handleUpdateItem(item.id, { shiftX: (item.shiftX || 0) - 10 })}><ArrowLeft className="h-3 w-3" /></Button>
                                                                <div className="flex flex-col gap-1">
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-white p-0 hover:bg-white/10" onClick={() => handleUpdateItem(item.id, { shiftY: (item.shiftY || 0) - 10 })}><ChevronUp className="h-3 w-3" /></Button>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-white p-0 hover:bg-white/10" onClick={() => handleUpdateItem(item.id, { shiftY: (item.shiftY || 0) + 10 })}><ChevronDown className="h-3 w-3" /></Button>
                                                                </div>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-white p-0 hover:bg-white/10" onClick={() => handleUpdateItem(item.id, { shiftX: (item.shiftX || 0) + 10 })}><div className="rotate-180"><ArrowLeft className="h-3 w-3" /></div></Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </Rnd>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Branding Bar (Right Case) */}
                            {!isEven && (
                                <div className={`w-16 md:w-28 ${color.bg} flex flex-col py-12 items-center justify-between relative overflow-hidden shrink-0 transition-colors duration-1000 z-10`}>
                                    <div className="transform rotate-90 w-48 h-12 flex items-center justify-center mb-32 origin-center">
                                        <img
                                            src="https://xgdmyjzyejjmwdqkufhp.supabase.co/storage/v1/object/public/logo_ecomoving/Logo_horizontal.png"
                                            className="max-w-full max-h-full object-contain filter brightness-0 invert opacity-80"
                                            alt="Ecomoving"
                                        />
                                    </div>
                                    <div className={`w-1 h-32 mt-12 ${color.line}`}></div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <style>{`
                @page {
                    size: ${dimensions.width} ${dimensions.height};
                    margin: 0;
                }
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; padding: 0 !important; margin: 0 !important; }
                    .brochure-page {
                        box-shadow: none !important;
                        margin: 0 !important;
                        page-break-after: always;
                    }
                    .react-draggable { border: none !important; box-shadow: none !important; }
                }

                .brochure-page {
                    user-select: none;
                }
            `}</style>
        </div>
    );
}
