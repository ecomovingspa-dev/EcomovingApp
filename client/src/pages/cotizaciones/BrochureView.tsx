import { useRef } from "react";
import type { Cotizacion } from "../../types";
import { Button } from "@/components/ui/button";
import { Download, Share2, ArrowLeft, MousePointer2, LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Rnd } from "react-rnd";

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

    const items = cotizacion.items || [];

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
            ? (pageSize === "carta" ? "279mm" : "297mm")
            : (pageSize === "carta" ? "216mm" : "210mm"),
        height: orientation === "landscape"
            ? (pageSize === "carta" ? "216mm" : "210mm")
            : (pageSize === "carta" ? "279mm" : "297mm")
    };

    const handleUpdateItem = (id: string | number, updates: any) => {
        if (!onUpdateItems) return;
        const newItems = items.map(item =>
            item.id.toString() === id.toString() ? { ...item, ...updates } : item
        );
        onUpdateItems(newItems);
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
                    <Button onClick={() => window.print()} className="bg-white text-black hover:bg-gray-200 font-bold">
                        <Download className="mr-2 h-4 w-4" /> Exportar Mural ({pages.length} {pages.length === 1 ? 'Pág' : 'Págs'})
                    </Button>
                </div>
            </div>

            <div ref={brochureRef} className="flex flex-col gap-16 items-center pb-32">
                {pages.map((pageItems, pageIdx) => {
                    const color = BAR_COLORS[pageIdx % BAR_COLORS.length];
                    const isEven = pageIdx % 2 === 0;

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
                                    <div className={`transform -rotate-90 whitespace-nowrap mt-32 ${color.text} font-black tracking-[0.4em] text-[20px] md:text-[24px] uppercase origin-center`}>
                                        ECOMOWING
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
                                                    <img
                                                        src={item.imagen}
                                                        alt=""
                                                        className={`w-full h-full transition-all duration-[3s] ease-in-out ${item.fitMode === "contain"
                                                            ? "object-contain p-6"
                                                            : "object-cover group-hover:scale-105"
                                                            }`}
                                                    />
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

                                        {pageItems.map((item: any) => (
                                            <Rnd
                                                key={item.id}
                                                default={{
                                                    x: item.x || 50,
                                                    y: item.y || 50,
                                                    width: item.w || 200,
                                                    height: item.h || 200,
                                                }}
                                                bounds="parent"
                                                onDragStop={(e, d) => handleUpdateItem(item.id, { x: d.x, y: d.y })}
                                                onResizeStop={(e, direction, ref, delta, position) => {
                                                    handleUpdateItem(item.id, {
                                                        width: ref.offsetWidth,
                                                        height: ref.offsetHeight,
                                                        ...position,
                                                    });
                                                }}
                                                className="group"
                                            >
                                                <div className={`w-full h-full border-2 border-transparent hover:border-amber-400 transition-colors shadow-sm cursor-move relative overflow-hidden ${item.fitMode === 'contain' ? 'bg-white' : ''}`}>
                                                    <img
                                                        src={item.imagen}
                                                        alt=""
                                                        className={`w-full h-full pointer-events-none ${item.fitMode === 'contain' ? 'object-contain p-4' : 'object-cover'}`}
                                                    />
                                                    {/* Control Overlay (Visible on Hover in Editor) */}
                                                    <div className="absolute inset-0 bg-transparent group-hover:bg-amber-500/5 transition-all"></div>
                                                </div>
                                            </Rnd>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Branding Bar (Right Case) */}
                            {!isEven && (
                                <div className={`w-16 md:w-28 ${color.bg} flex flex-col py-12 items-center justify-between relative overflow-hidden shrink-0 transition-colors duration-1000 z-10`}>
                                    <div className={`transform rotate-90 whitespace-nowrap mb-32 ${color.text} font-black tracking-[0.4em] text-[20px] md:text-[24px] uppercase origin-center`}>
                                        ECOMOWING
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
