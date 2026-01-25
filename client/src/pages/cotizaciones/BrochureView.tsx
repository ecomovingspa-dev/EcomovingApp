import { useRef } from "react";
import type { Cotizacion } from "../../types";
import { Button } from "@/components/ui/button";
import { Download, Share2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BrochureViewProps {
    cotizacion: Partial<Cotizacion>;
    onBack?: () => void;
    rows: number;
    cols: number;
    orientation?: "portrait" | "landscape";
    pageSize?: "a4" | "carta";
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
    orientation = "portrait",
    pageSize = "carta"
}: BrochureViewProps) {
    const navigate = useNavigate();
    const brochureRef = useRef<HTMLDivElement>(null);

    const items = cotizacion.items || [];

    // Matrix Pagination Logic
    const itemsPerPage = rows * cols;
    const numPages = Math.ceil(items.length / itemsPerPage);
    const pages = [];

    for (let i = 0; i < items.length; i += itemsPerPage) {
        pages.push(items.slice(i, i + itemsPerPage));
    }

    const dimensions = {
        width: orientation === "landscape"
            ? (pageSize === "carta" ? "279mm" : "297mm")
            : (pageSize === "carta" ? "216mm" : "210mm"),
        height: orientation === "landscape"
            ? (pageSize === "carta" ? "216mm" : "210mm")
            : (pageSize === "carta" ? "279mm" : "297mm")
    };

    return (
        <div className="min-h-screen bg-neutral-900 text-white p-8 font-sans">
            {/* Controls */}
            <div className="mb-8 flex justify-between items-center no-print border-b border-white/10 pb-4 max-w-[1200px] mx-auto">
                <Button
                    variant="ghost"
                    onClick={onBack || (() => navigate(-1))}
                    className="text-white hover:bg-neutral-800 font-bold"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver a edición
                </Button>
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
                            className={`bg-white text-neutral-900 shadow-2xl overflow-hidden flex flex-row brochure-page print:shadow-none print:m-0`}
                            style={{
                                width: dimensions.width,
                                height: dimensions.height,
                                minHeight: dimensions.height,
                            }}
                        >
                            {/* Branding Bar (Left Case) */}
                            {isEven && (
                                <div className={`w-16 md:w-28 ${color.bg} flex flex-col py-12 items-center justify-between relative overflow-hidden shrink-0 transition-colors duration-1000`}>
                                    <div className={`transform -rotate-90 whitespace-nowrap mt-32 ${color.text} font-black tracking-[0.4em] text-2xl md:text-3xl uppercase origin-center`}>
                                        ECOMOWING
                                    </div>
                                    <div className={`w-1 h-32 mb-12 ${color.line}`}></div>
                                </div>
                            )}

                            {/* Matrix Images Area */}
                            <div className="flex-1 overflow-hidden bg-white relative">
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
                            </div>

                            {/* Branding Bar (Right Case) */}
                            {!isEven && (
                                <div className={`w-16 md:w-28 ${color.bg} flex flex-col py-12 items-center justify-between relative overflow-hidden shrink-0 transition-colors duration-1000`}>
                                    <div className={`transform rotate-90 whitespace-nowrap mb-32 ${color.text} font-black tracking-[0.4em] text-2xl md:text-3xl uppercase origin-center`}>
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
                }
            `}</style>
        </div>
    );
}
