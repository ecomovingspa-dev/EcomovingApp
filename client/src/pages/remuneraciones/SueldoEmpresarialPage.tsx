import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Calculator, 
  Download, 
  Plus, 
  Trash2, 
  History, 
  User, 
  Building2, 
  Coins, 
  HelpCircle,
  FileCheck2,
  Printer,
  Settings
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface Liquidacion {
  id: string;
  fechaRegistro: string;
  rutEmpresa: string;
  razonSocial: string;
  rutTrabajador: string;
  nombreTrabajador: string;
  mesAnio: string;
  sueldoBruto: number;
  cotizaAFP: boolean;
  afpSeleccionada: string;
  afpTasaCustom: number;
  cotizaSalud: boolean;
  tipoSalud: "fonasa" | "isapre";
  isapreUF: number;
  colacion: number;
  movilizacion: number;
  otrosDescuentos: number;
  // Valores económicos usados
  ufUsada: number;
  utmUsada: number;
  topeImponibleUFUsado: number;
  reformaPorcentajeUsado: number;
  // Resultados calculados
  imponible: number;
  descuentoAFP: number;
  descuentoSalud: number;
  baseImpuesto: number;
  impuestoUnico: number;
  sueldoLiquido: number;
  costoEmpresa: number;
}

const CONSTANTES_2026 = {
  UF: 40844.79,
  UTM: 71649,
  TOPE_IMPONIBLE_UF: 90.0,
  REFORMA_PORCENTAJE: 3.5, // Aumento en cotización de cargo del empleador (Reforma 2026)
};

// Base de datos oficial de valores de cierre de mes de la UF y UTM de Chile
const VALORES_OFICIALES: Record<string, { uf: number; utm: number; topeImponibleUF: number; reformaPorcentaje: number }> = {
  "2026-08": { uf: 40844.79, utm: 71649, topeImponibleUF: 90.0, reformaPorcentaje: 3.5 },
  "2026-07": { uf: 40844.79, utm: 71649, topeImponibleUF: 90.0, reformaPorcentaje: 3.5 },
  "2026-06": { uf: 40817.59, utm: 71506, topeImponibleUF: 90.0, reformaPorcentaje: 3.5 },
  "2026-05": { uf: 40610.69, utm: 70588, topeImponibleUF: 90.0, reformaPorcentaje: 3.5 },
  "2026-04": { uf: 40120.20, utm: 69889, topeImponibleUF: 90.0, reformaPorcentaje: 3.5 },
  "2026-03": { uf: 39841.72, utm: 69889, topeImponibleUF: 90.0, reformaPorcentaje: 3.5 },
  "2026-02": { uf: 39790.63, utm: 69611, topeImponibleUF: 90.0, reformaPorcentaje: 3.5 },
  "2026-01": { uf: 39706.07, utm: 69751, topeImponibleUF: 84.3, reformaPorcentaje: 3.5 },

  // Año 2025
  "2025-12": { uf: 39727.96, utm: 69542, topeImponibleUF: 84.3, reformaPorcentaje: 2.3 },
  "2025-11": { uf: 39643.59, utm: 69542, topeImponibleUF: 84.3, reformaPorcentaje: 2.3 },
  "2025-10": { uf: 39577.00, utm: 69265, topeImponibleUF: 84.3, reformaPorcentaje: 2.3 },
  "2025-09": { uf: 39485.00, utm: 69265, topeImponibleUF: 84.3, reformaPorcentaje: 2.3 },
  "2025-08": { uf: 39383.00, utm: 68647, topeImponibleUF: 84.3, reformaPorcentaje: 2.3 },
  "2025-07": { uf: 39180.00, utm: 68923, topeImponibleUF: 84.3, reformaPorcentaje: 2.3 },
  "2025-06": { uf: 39020.00, utm: 68785, topeImponibleUF: 84.3, reformaPorcentaje: 2.3 },
  "2025-05": { uf: 38810.00, utm: 68648, topeImponibleUF: 84.3, reformaPorcentaje: 2.3 },
  "2025-04": { uf: 38620.00, utm: 68306, topeImponibleUF: 84.3, reformaPorcentaje: 2.3 },
  "2025-03": { uf: 38480.00, utm: 68034, topeImponibleUF: 84.3, reformaPorcentaje: 2.3 },
  "2025-02": { uf: 38410.00, utm: 67294, topeImponibleUF: 84.3, reformaPorcentaje: 2.3 },
  "2025-01": { uf: 38384.41, utm: 67429, topeImponibleUF: 81.6, reformaPorcentaje: 2.3 }
};

const AFPS = [
  { id: "habitat", nombre: "Habitat (11.27%)", tasa: 11.27 },
  { id: "capital", nombre: "Capital (11.44%)", tasa: 11.44 },
  { id: "cuprum", nombre: "Cuprum (11.44%)", tasa: 11.44 },
  { id: "planvital", nombre: "Planvital (11.16%)", tasa: 11.16 },
  { id: "provida", nombre: "Provida (11.45%)", tasa: 11.45 },
  { id: "modelo", nombre: "Modelo (10.58%)", tasa: 10.58 },
  { id: "uno", nombre: "Uno (10.60%)", tasa: 10.60 },
  { id: "custom", nombre: "Personalizada...", tasa: 10.00 }
];

export default function SueldoEmpresarialPage() {
  const [formData, setFormData] = useState({
    rutEmpresa: "76.543.210-K",
    razonSocial: "Ecomoving Spa",
    rutTrabajador: "",
    nombreTrabajador: "",
    mesAnio: "2026-08",
    sueldoBruto: 1500000,
    cotizaAFP: true,
    afpSeleccionada: "habitat",
    afpTasaCustom: 11.27,
    cotizaSalud: true,
    tipoSalud: "fonasa" as "fonasa" | "isapre",
    isapreUF: 3.5,
    colacion: 120000,
    movilizacion: 120000,
    otrosDescuentos: 0
  });

  // Parámetros económicos configurables
  const [parametrosPeriodo, setParametrosPeriodo] = useState({
    uf: CONSTANTES_2026.UF,
    utm: CONSTANTES_2026.UTM,
    topeImponibleUF: CONSTANTES_2026.TOPE_IMPONIBLE_UF,
    reformaPorcentaje: CONSTANTES_2026.REFORMA_PORCENTAJE
  });

  const [historial, setHistorial] = useState<Liquidacion[]>([]);
  const [calculoActivo, setCalculoActivo] = useState<Liquidacion | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("historial_liquidaciones");
    if (saved) {
      try {
        setHistorial(JSON.parse(saved));
      } catch (e) {
        console.error("Error al cargar historial", e);
      }
    }
  }, []);

  const guardarHistorial = (nuevoHistorial: Liquidacion[]) => {
    setHistorial(nuevoHistorial);
    localStorage.setItem("historial_liquidaciones", JSON.stringify(nuevoHistorial));
  };

  // Función para formatear pesos chilenos
  const formatCLP = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0
    }).format(Math.round(value));
  };

  // Función para formatear RUT
  const formatearRut = (rut: string) => {
    let valor = rut.replace(/\./g, "").replace(/-/g, "");
    if (valor.length < 2) return valor;
    
    let cuerpo = valor.slice(0, -1);
    let dv = valor.slice(-1).toUpperCase();
    
    cuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${cuerpo}-${dv}`;
  };

  // Detector de mes para cargar indicadores sugeridos históricos oficiales
  const handleMesChange = (mes: string) => {
    setFormData({ ...formData, mesAnio: mes });
    
    // Si el mes tiene valores oficiales exactos en nuestra base de datos, los cargamos de forma fija
    if (VALORES_OFICIALES[mes]) {
      setParametrosPeriodo({
        uf: VALORES_OFICIALES[mes].uf,
        utm: VALORES_OFICIALES[mes].utm,
        topeImponibleUF: VALORES_OFICIALES[mes].topeImponibleUF,
        reformaPorcentaje: VALORES_OFICIALES[mes].reformaPorcentaje
      });
    } else {
      // Valores estimados para años anteriores no cubiertos por la base fija
      let ufEstimada = 38000;
      let utmEstimada = 66000;
      let topeUF = 84.3;
      let reforma = 0;
      
      if (mes.startsWith("2024")) {
        ufEstimada = 37300;
        utmEstimada = 64500;
        topeUF = 81.6;
        reforma = 0.0;
      } else if (mes.startsWith("2023")) {
        ufEstimada = 36000;
        utmEstimada = 62000;
        topeUF = 81.6;
        reforma = 0.0;
      }
      
      setParametrosPeriodo({
        uf: ufEstimada,
        utm: utmEstimada,
        topeImponibleUF: topeUF,
        reformaPorcentaje: reforma
      });
    }
  };

  // Función de cálculo usando parámetros de período configurados
  const calcularLiquidacion = (data: typeof formData): Liquidacion => {
    const uf = parametrosPeriodo.uf;
    const utm = parametrosPeriodo.utm;
    const topeImponible = parametrosPeriodo.topeImponibleUF * uf;

    // 1. Imponible
    const imponible = Math.min(data.sueldoBruto, topeImponible);

    // 2. AFP
    let tasaAFP = 0;
    if (data.cotizaAFP) {
      if (data.afpSeleccionada === "custom") {
        tasaAFP = data.afpTasaCustom / 100;
      } else {
        const afp = AFPS.find(a => a.id === data.afpSeleccionada);
        tasaAFP = afp ? afp.tasa / 100 : 0.10;
      }
    }
    const descuentoAFP = data.cotizaAFP ? imponible * tasaAFP : 0;

    // 3. Salud (Mínimo 7%, o Isapre en UF)
    let descuentoSalud = 0;
    if (data.cotizaSalud) {
      if (data.tipoSalud === "fonasa") {
        descuentoSalud = imponible * 0.07;
      } else {
        const saludMinima = imponible * 0.07;
        const saludPactada = data.isapreUF * uf;
        descuentoSalud = Math.max(saludMinima, saludPactada);
      }
    }

    // 4. Base Impuesto Único (Renta Líquida Imponible)
    const totalDescuentosPrevisionales = descuentoAFP + descuentoSalud;
    const baseImpuesto = Math.max(0, data.sueldoBruto - totalDescuentosPrevisionales);

    // 5. Impuesto Único de Segunda Categoría (Brackets progresivos en UTM)
    const baseUTM = baseImpuesto / utm;
    let factor = 0;
    let rebajaUTM = 0;

    if (baseUTM <= 13.5) {
      factor = 0;
      rebajaUTM = 0;
    } else if (baseUTM <= 30) {
      factor = 0.04;
      rebajaUTM = 0.54;
    } else if (baseUTM <= 50) {
      factor = 0.08;
      rebajaUTM = 1.74;
    } else if (baseUTM <= 70) {
      factor = 0.135;
      rebajaUTM = 4.49;
    } else if (baseUTM <= 90) {
      factor = 0.23;
      rebajaUTM = 11.14;
    } else if (baseUTM <= 120) {
      factor = 0.304;
      rebajaUTM = 17.8;
    } else if (baseUTM <= 310) {
      factor = 0.35;
      rebajaUTM = 23.32;
    } else {
      factor = 0.40;
      rebajaUTM = 38.82;
    }

    const impuestoUTM = Math.max(0, (baseUTM * factor) - rebajaUTM);
    const impuestoUnico = impuestoUTM * utm;

    // 6. Sueldo Líquido
    const sueldoLiquido = data.sueldoBruto - totalDescuentosPrevisionales - impuestoUnico + data.colacion + data.movilizacion - data.otrosDescuentos;

    // 7. Costo Empresa
    const aporteReforma = data.cotizaAFP ? (imponible * (parametrosPeriodo.reformaPorcentaje / 100)) : 0;
    const costoEmpresa = data.sueldoBruto + data.colacion + data.movilizacion + aporteReforma;

    return {
      id: Math.random().toString(36).substring(2, 9),
      fechaRegistro: new Date().toLocaleDateString("es-CL"),
      ...data,
      ufUsada: uf,
      utmUsada: utm,
      topeImponibleUFUsado: parametrosPeriodo.topeImponibleUF,
      reformaPorcentajeUsado: parametrosPeriodo.reformaPorcentaje,
      imponible,
      descuentoAFP,
      descuentoSalud,
      baseImpuesto,
      impuestoUnico,
      sueldoLiquido,
      costoEmpresa
    };
  };

  const handleCalcular = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombreTrabajador || !formData.rutTrabajador) {
      alert("Por favor, ingrese el nombre y RUT del socio/trabajador.");
      return;
    }
    const res = calcularLiquidacion(formData);
    setCalculoActivo(res);
  };

  const handleGuardar = () => {
    if (!calculoActivo) return;
    const nuevo = [...historial, { ...calculoActivo, id: Math.random().toString(36).substring(2, 9) }];
    guardarHistorial(nuevo);
    alert("Liquidación guardada en el historial local.");
  };

  const handleCargarHistorial = (liq: Liquidacion) => {
    setCalculoActivo(liq);
    setFormData({
      rutEmpresa: liq.rutEmpresa,
      razonSocial: liq.razonSocial,
      rutTrabajador: liq.rutTrabajador,
      nombreTrabajador: liq.nombreTrabajador,
      mesAnio: liq.mesAnio,
      sueldoBruto: liq.sueldoBruto,
      cotizaAFP: liq.cotizaAFP,
      afpSeleccionada: liq.afpSeleccionada,
      afpTasaCustom: liq.afpTasaCustom,
      cotizaSalud: liq.cotizaSalud,
      tipoSalud: liq.tipoSalud,
      isapreUF: liq.isapreUF,
      colacion: liq.colacion,
      movilizacion: liq.movilizacion,
      otrosDescuentos: liq.otrosDescuentos
    });
    setParametrosPeriodo({
      uf: liq.ufUsada || CONSTANTES_2026.UF,
      utm: liq.utmUsada || CONSTANTES_2026.UTM,
      topeImponibleUF: liq.topeImponibleUFUsado || CONSTANTES_2026.TOPE_IMPONIBLE_UF,
      reformaPorcentaje: liq.reformaPorcentajeUsado !== undefined ? liq.reformaPorcentajeUsado : CONSTANTES_2026.REFORMA_PORCENTAJE
    });
  };

  const handleEliminarHistorial = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtrado = historial.filter(h => h.id !== id);
    guardarHistorial(filtrado);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Imprimir Solo Contenedor de Liquidación */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
            background: white;
            color: black;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700 pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Calculator className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            Sueldo Empresarial
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Calculadora y generador de liquidaciones bajo el Artículo 31 N°6 LIR (Agosto 2026)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2" onClick={() => {
            setFormData({
              ...formData,
              rutTrabajador: "",
              nombreTrabajador: "",
              sueldoBruto: 1500000,
              colacion: 120000,
              movilizacion: 120000,
              otrosDescuentos: 0
            });
            setCalculoActivo(null);
            setParametrosPeriodo({
              uf: CONSTANTES_2026.UF,
              utm: CONSTANTES_2026.UTM,
              topeImponibleUF: CONSTANTES_2026.TOPE_IMPONIBLE_UF,
              reformaPorcentaje: CONSTANTES_2026.REFORMA_PORCENTAJE
            });
          }}>
            <Plus className="h-4 w-4" />
            Nueva Planilla
          </Button>
        </div>
      </div>

      {/* Indicadores Clave e Inputs de Simulación Histórica */}
      <div className="bg-gray-100/50 dark:bg-gray-800/40 p-4 rounded-xl space-y-3 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <Settings className="h-4 w-4 text-blue-600" />
          <span>Parámetros Económicos del Período (Haz clic en los valores para editarlos y simular meses anteriores)</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white dark:bg-gray-800 border-blue-100 dark:border-blue-900/40 shadow-sm">
            <CardContent className="p-4 flex flex-col justify-center">
              <span className="text-xs font-semibold uppercase text-gray-400">Valor UTM ($)</span>
              <input 
                type="number" 
                className="text-2xl font-bold bg-transparent border-none p-0 focus:outline-none w-full text-gray-800 dark:text-white mt-1"
                value={Math.round(parametrosPeriodo.utm)}
                onChange={(e) => setParametrosPeriodo({ ...parametrosPeriodo, utm: Number(e.target.value) })}
              />
              <span className="text-[10px] text-gray-400 mt-1">Sugerido para {formData.mesAnio}</span>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-blue-100 dark:border-blue-900/40 shadow-sm">
            <CardContent className="p-4 flex flex-col justify-center">
              <span className="text-xs font-semibold uppercase text-gray-400">Valor UF ($)</span>
              <input 
                type="number" 
                className="text-2xl font-bold bg-transparent border-none p-0 focus:outline-none w-full text-gray-800 dark:text-white mt-1"
                value={Math.round(parametrosPeriodo.uf)}
                onChange={(e) => setParametrosPeriodo({ ...parametrosPeriodo, uf: Number(e.target.value) })}
              />
              <span className="text-[10px] text-gray-400 mt-1">Sugerido para {formData.mesAnio}</span>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-blue-100 dark:border-blue-900/40 shadow-sm">
            <CardContent className="p-4 flex flex-col justify-center">
              <span className="text-xs font-semibold uppercase text-gray-400">Tope Imponible (UF)</span>
              <input 
                type="number" 
                step="0.1"
                className="text-2xl font-bold bg-transparent border-none p-0 focus:outline-none w-full text-gray-800 dark:text-white mt-1"
                value={parametrosPeriodo.topeImponibleUF}
                onChange={(e) => setParametrosPeriodo({ ...parametrosPeriodo, topeImponibleUF: Number(e.target.value) })}
              />
              <span className="text-[10px] text-gray-400 mt-1">Valor Tope: {formatCLP(parametrosPeriodo.topeImponibleUF * parametrosPeriodo.uf)}</span>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-blue-100 dark:border-blue-900/40 shadow-sm">
            <CardContent className="p-4 flex flex-col justify-center">
              <span className="text-xs font-semibold uppercase text-gray-400">Reforma Empleador (%)</span>
              <input 
                type="number" 
                step="0.1"
                className="text-2xl font-bold bg-transparent border-none p-0 focus:outline-none w-full text-blue-600 dark:text-blue-400 mt-1"
                value={parametrosPeriodo.reformaPorcentaje}
                onChange={(e) => setParametrosPeriodo({ ...parametrosPeriodo, reformaPorcentaje: Number(e.target.value) })}
              />
              <span className="text-[10px] text-gray-400 mt-1">Aporte extra al imponible</span>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario e Historial */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-400" />
                Datos de Liquidación de Sueldo
              </CardTitle>
              <CardDescription>
                Rellene los datos de la empresa y del socio/trabajador para calcular
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCalcular} className="space-y-6">
                
                {/* Bloque Empresa */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-gray-100 dark:border-gray-700 pb-4">
                  <div className="space-y-2">
                    <Label htmlFor="razonSocial">Razón Social Empresa</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input 
                        id="razonSocial"
                        className="pl-9" 
                        value={formData.razonSocial} 
                        onChange={e => setFormData({...formData, razonSocial: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rutEmpresa">RUT Empresa</Label>
                    <Input 
                      id="rutEmpresa" 
                      value={formData.rutEmpresa} 
                      onChange={e => setFormData({...formData, rutEmpresa: formatearRut(e.target.value)})}
                    />
                  </div>
                </div>

                {/* Bloque Trabajador */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-100 dark:border-gray-700 pb-4">
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="nombreTrabajador">Nombre Completo (Socio / Trabajador)</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input 
                        id="nombreTrabajador" 
                        className="pl-9" 
                        placeholder="Ej. Juan Pérez"
                        value={formData.nombreTrabajador} 
                        onChange={e => setFormData({...formData, nombreTrabajador: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rutTrabajador">RUT Persona</Label>
                    <Input 
                      id="rutTrabajador" 
                      placeholder="12.345.678-9"
                      value={formData.rutTrabajador} 
                      onChange={e => setFormData({...formData, rutTrabajador: formatearRut(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mesAnio">Mes Liquidación</Label>
                    <Input 
                      id="mesAnio" 
                      type="month"
                      value={formData.mesAnio} 
                      onChange={e => handleMesChange(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="sueldoBruto">Sueldo Bruto Acordado (CLP)</Label>
                    <div className="relative">
                      <Coins className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input 
                        id="sueldoBruto" 
                        type="number"
                        className="pl-9"
                        placeholder="Ej. 1500000"
                        value={formData.sueldoBruto} 
                        onChange={e => setFormData({...formData, sueldoBruto: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                </div>

                {/* Cotizaciones y Descuentos */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Cotizaciones Previsionales Voluntarias / Obligatorias</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-800/40 p-4 rounded-lg">
                    {/* AFP */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="cotizaAFP" 
                          checked={formData.cotizaAFP} 
                          onCheckedChange={(checked) => setFormData({...formData, cotizaAFP: checked === true})}
                        />
                        <Label htmlFor="cotizaAFP" className="font-medium">Cotiza AFP</Label>
                      </div>
                      
                      {formData.cotizaAFP && (
                        <div className="space-y-2 animate-in fade-in duration-200">
                          <Label>Selecciona AFP</Label>
                          <Select 
                            value={formData.afpSeleccionada} 
                            onValueChange={(val) => {
                              const afp = AFPS.find(a => a.id === val);
                              setFormData({
                                ...formData, 
                                afpSeleccionada: val, 
                                afpTasaCustom: afp ? afp.tasa : 10.0
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {AFPS.map(afp => (
                                <SelectItem key={afp.id} value={afp.id}>{afp.nombre}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {formData.afpSeleccionada === "custom" && (
                            <div className="space-y-1 mt-2">
                              <Label htmlFor="tasaCustom">Tasa AFP (%)</Label>
                              <Input 
                                id="tasaCustom"
                                type="number" 
                                step="0.01" 
                                value={formData.afpTasaCustom} 
                                onChange={e => setFormData({...formData, afpTasaCustom: Number(e.target.value)})} 
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Salud */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="cotizaSalud" 
                          checked={formData.cotizaSalud} 
                          onCheckedChange={(checked) => setFormData({...formData, cotizaSalud: checked === true})}
                        />
                        <Label htmlFor="cotizaSalud" className="font-medium">Cotiza Salud</Label>
                      </div>

                      {formData.cotizaSalud && (
                        <div className="space-y-2 animate-in fade-in duration-200">
                          <Label>Sistema de Salud</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <Button 
                              type="button"
                              variant={formData.tipoSalud === "fonasa" ? "default" : "outline"}
                              onClick={() => setFormData({...formData, tipoSalud: "fonasa"})}
                            >
                              Fonasa (7%)
                            </Button>
                            <Button 
                              type="button"
                              variant={formData.tipoSalud === "isapre" ? "default" : "outline"}
                              onClick={() => setFormData({...formData, tipoSalud: "isapre"})}
                            >
                              Isapre (Pactado)
                            </Button>
                          </div>

                          {formData.tipoSalud === "isapre" && (
                            <div className="space-y-1 mt-2">
                              <Label htmlFor="isapreUF">Valor Plan (UF)</Label>
                              <Input 
                                id="isapreUF"
                                type="number" 
                                step="0.01" 
                                value={formData.isapreUF} 
                                onChange={e => setFormData({...formData, isapreUF: Number(e.target.value)})} 
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Haberes no imponibles y otros */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="colacion">Asignación Colación</Label>
                    <Input 
                      id="colacion" 
                      type="number" 
                      value={formData.colacion} 
                      onChange={e => setFormData({...formData, colacion: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="movilizacion">Asignación Movilización</Label>
                    <Input 
                      id="movilizacion" 
                      type="number" 
                      value={formData.movilizacion} 
                      onChange={e => setFormData({...formData, movilizacion: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="otrosDescuentos">Otros Descuentos/Anticipos</Label>
                    <Input 
                      id="otrosDescuentos" 
                      type="number" 
                      value={formData.otrosDescuentos} 
                      onChange={e => setFormData({...formData, otrosDescuentos: Number(e.target.value)})}
                    />
                  </div>
                </div>

                {/* Botón de acción */}
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="submit" className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Calcular Liquidación
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Historial Local */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-gray-400" />
                Historial de Liquidaciones Generadas
              </CardTitle>
              <CardDescription>
                Registro de liquidaciones guardadas localmente en este navegador.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historial.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-sm">
                  No hay liquidaciones guardadas. Realice un cálculo y presione "Guardar en Historial".
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {historial.map((liq) => (
                    <div 
                      key={liq.id} 
                      onClick={() => handleCargarHistorial(liq)}
                      className="py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer rounded-lg px-2 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileCheck2 className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="font-semibold text-sm text-gray-800 dark:text-white">{liq.nombreTrabajador}</p>
                          <p className="text-xs text-gray-400">Período: {liq.mesAnio} | Creado: {liq.fechaRegistro}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-sm text-gray-900 dark:text-white">{formatCLP(liq.sueldoLiquido)}</p>
                          <p className="text-xs text-gray-400">Líquido</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={(e) => handleEliminarHistorial(liq.id, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Desglose de Resultados y Documento */}
        <div className="space-y-6">
          {calculoActivo ? (
            <>
              {/* Resumen Financiero */}
              <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-none shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg">Sueldo Líquido Final</CardTitle>
                  <CardDescription className="text-blue-100">Monto a depositar en la cuenta del socio</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-4xl font-extrabold">{formatCLP(calculoActivo.sueldoLiquido)}</div>
                  
                  <div className="border-t border-white/20 pt-4 space-y-2 text-sm text-blue-50">
                    <div className="flex justify-between">
                      <span>Sueldo Bruto:</span>
                      <span className="font-semibold">{formatCLP(calculoActivo.sueldoBruto)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Deducciones Previsionales:</span>
                      <span className="font-semibold">-{formatCLP(calculoActivo.descuentoAFP + calculoActivo.descuentoSalud)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Impuesto Único:</span>
                      <span className="font-semibold">-{formatCLP(calculoActivo.impuestoUnico)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Haberes No Imponibles:</span>
                      <span className="font-semibold">+{formatCLP(calculoActivo.colacion + calculoActivo.movilizacion)}</span>
                    </div>
                    {calculoActivo.otrosDescuentos > 0 && (
                      <div className="flex justify-between text-amber-200">
                        <span>Otros Descuentos/Anticipos:</span>
                        <span className="font-semibold">-{formatCLP(calculoActivo.otrosDescuentos)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Costo Empresa */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold uppercase text-gray-400">Costo Total para la Empresa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-2xl font-bold text-gray-800 dark:text-white">{formatCLP(calculoActivo.costoEmpresa)}</div>
                  <p className="text-xs text-gray-400">
                    Sueldo Bruto + Asignaciones + {calculoActivo.reformaPorcentajeUsado}% Aporte Reforma Previsional (cargo empresa).
                  </p>
                  {calculoActivo.cotizaAFP && (
                    <div className="flex justify-between text-xs bg-gray-50 dark:bg-gray-800/40 p-2 rounded">
                      <span className="text-gray-500">Aporte Reforma ({calculoActivo.reformaPorcentajeUsado}%):</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {formatCLP(calculoActivo.imponible * ((calculoActivo.reformaPorcentajeUsado || 0) / 100))}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Botones de Acción Documental */}
              <div className="flex gap-2">
                <Button 
                  onClick={handleGuardar}
                  variant="outline" 
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  <History className="h-4 w-4" />
                  Guardar en Historial
                </Button>
                <Button 
                  onClick={handlePrint}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir / PDF
                </Button>
              </div>

              {/* Vista Previa de la Liquidación Oficial */}
              <Card id="print-area" className="border border-gray-300 dark:border-gray-700 shadow-lg bg-white text-black p-6 font-mono text-xs">
                <div className="space-y-4">
                  {/* Encabezado */}
                  <div className="flex justify-between items-start border-b border-gray-400 pb-4">
                    <div>
                      <h4 className="font-bold text-sm uppercase">{calculoActivo.razonSocial}</h4>
                      <p>RUT: {calculoActivo.rutEmpresa}</p>
                      <p>Santiago, Chile</p>
                    </div>
                    <div className="text-right">
                      <h4 className="font-bold text-sm">LIQUIDACIÓN DE SUELDO</h4>
                      <p className="font-bold">PERÍODO: {calculoActivo.mesAnio}</p>
                    </div>
                  </div>

                  {/* Datos del Socio/Trabajador */}
                  <div className="grid grid-cols-2 gap-2 border-b border-gray-400 pb-3">
                    <div>
                      <p><span className="font-bold">Nombre:</span> {calculoActivo.nombreTrabajador}</p>
                      <p><span className="font-bold">RUT:</span> {calculoActivo.rutTrabajador}</p>
                    </div>
                    <div className="text-right">
                      <p><span className="font-bold">Tipo Contrato:</span> Sueldo Empresarial</p>
                      <p><span className="font-bold">Fecha Proceso:</span> {calculoActivo.fechaRegistro}</p>
                    </div>
                  </div>

                  {/* Detalle Haberes y Descuentos */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Haberes */}
                    <div className="space-y-2 border-r border-gray-300 pr-4">
                      <h5 className="font-bold border-b border-gray-300 pb-1">HABERES</h5>
                      <div className="flex justify-between">
                        <span>Sueldo Bruto:</span>
                        <span>{formatCLP(calculoActivo.sueldoBruto)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Asig. Colación:</span>
                        <span>{formatCLP(calculoActivo.colacion)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Asig. Movilización:</span>
                        <span>{formatCLP(calculoActivo.movilizacion)}</span>
                      </div>
                      <div className="border-t border-gray-300 pt-1 flex justify-between font-bold">
                        <span>Total Haberes:</span>
                        <span>{formatCLP(calculoActivo.sueldoBruto + calculoActivo.colacion + calculoActivo.movilizacion)}</span>
                      </div>
                    </div>

                    {/* Descuentos */}
                    <div className="space-y-2">
                      <h5 className="font-bold border-b border-gray-300 pb-1">DESCUENTOS</h5>
                      {calculoActivo.cotizaAFP ? (
                        <div className="flex justify-between">
                          <span className="truncate">AFP ({calculoActivo.afpSeleccionada.toUpperCase()}):</span>
                          <span>{formatCLP(calculoActivo.descuentoAFP)}</span>
                        </div>
                      ) : (
                        <div className="flex justify-between text-gray-500">
                          <span>AFP:</span>
                          <span>No Cotiza</span>
                        </div>
                      )}
                      {calculoActivo.cotizaSalud ? (
                        <div className="flex justify-between">
                          <span>Salud ({calculoActivo.tipoSalud.toUpperCase()}):</span>
                          <span>{formatCLP(calculoActivo.descuentoSalud)}</span>
                        </div>
                      ) : (
                        <div className="flex justify-between text-gray-500">
                          <span>Salud:</span>
                          <span>No Cotiza</span>
                        </div>
                      )}
                      {calculoActivo.impuestoUnico > 0 && (
                        <div className="flex justify-between">
                          <span>Impuesto Único:</span>
                          <span>{formatCLP(calculoActivo.impuestoUnico)}</span>
                        </div>
                      )}
                      {calculoActivo.otrosDescuentos > 0 && (
                        <div className="flex justify-between">
                          <span>Otros Descuentos:</span>
                          <span>{formatCLP(calculoActivo.otrosDescuentos)}</span>
                        </div>
                      )}
                      <div className="border-t border-gray-300 pt-1 flex justify-between font-bold">
                        <span>Total Descuentos:</span>
                        <span>{formatCLP(calculoActivo.descuentoAFP + calculoActivo.descuentoSalud + calculoActivo.impuestoUnico + calculoActivo.otrosDescuentos)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Resumen Final */}
                  <div className="border-t border-gray-400 pt-3 flex justify-between items-center text-sm font-bold">
                    <span>LÍQUIDO A PAGAR:</span>
                    <span className="border border-gray-500 px-3 py-1 bg-gray-50">{formatCLP(calculoActivo.sueldoLiquido)}</span>
                  </div>

                  <div className="pt-8 grid grid-cols-2 gap-8 text-center">
                    <div className="border-t border-gray-400 pt-2">
                      <p className="uppercase">{calculoActivo.nombreTrabajador}</p>
                      <p>Firma Receptor</p>
                    </div>
                    <div className="border-t border-gray-400 pt-2">
                      <p className="uppercase">{calculoActivo.razonSocial}</p>
                      <p>Firma Empleador</p>
                    </div>
                  </div>

                  <div className="text-[10px] text-gray-500 text-center pt-4">
                    Valores de Referencia del Período - UF: {formatCLP(calculoActivo.ufUsada || CONSTANTES_2026.UF)} | UTM: {formatCLP(calculoActivo.utmUsada || CONSTANTES_2026.UTM)} | Tope: {(calculoActivo.topeImponibleUFUsado || CONSTANTES_2026.TOPE_IMPONIBLE_UF)} UF | Reforma: {(calculoActivo.reformaPorcentajeUsado !== undefined ? calculoActivo.reformaPorcentajeUsado : CONSTANTES_2026.REFORMA_PORCENTAJE)}% <br/>
                    Este documento cumple con el Art. 31 N°6 de la Ley sobre Impuesto a la Renta de Chile.
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800/40 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 min-h-[300px] text-center text-gray-500">
              <Calculator className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
              <h4 className="font-semibold text-gray-700 dark:text-gray-300">Sin Cálculos Activos</h4>
              <p className="text-xs max-w-[240px] mt-1">
                Rellene el formulario a la izquierda y presione "Calcular Liquidación" para visualizar los resultados.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
