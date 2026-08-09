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
import { supabase } from "@/lib/supabase";

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
  "2026-07": { uf: 40844.79, utm: 71649, topeImponibleUF: 90.0, reformaPorcentaje: 0.0 },
  "2026-06": { uf: 40817.59, utm: 71506, topeImponibleUF: 90.0, reformaPorcentaje: 0.0 },
  "2026-05": { uf: 40610.69, utm: 70588, topeImponibleUF: 90.0, reformaPorcentaje: 0.0 },
  "2026-04": { uf: 40120.20, utm: 69889, topeImponibleUF: 90.0, reformaPorcentaje: 0.0 },
  "2026-03": { uf: 39841.72, utm: 69889, topeImponibleUF: 90.0, reformaPorcentaje: 0.0 },
  "2026-02": { uf: 39790.63, utm: 69611, topeImponibleUF: 90.0, reformaPorcentaje: 0.0 },
  "2026-01": { uf: 39706.07, utm: 69751, topeImponibleUF: 84.3, reformaPorcentaje: 0.0 },

  // Año 2025
  "2025-12": { uf: 39727.96, utm: 69542, topeImponibleUF: 84.3, reformaPorcentaje: 0.0 },
  "2025-11": { uf: 39643.59, utm: 69542, topeImponibleUF: 84.3, reformaPorcentaje: 0.0 },
  "2025-10": { uf: 39577.00, utm: 69265, topeImponibleUF: 84.3, reformaPorcentaje: 0.0 },
  "2025-09": { uf: 39485.00, utm: 69265, topeImponibleUF: 84.3, reformaPorcentaje: 0.0 },
  "2025-08": { uf: 39383.00, utm: 68647, topeImponibleUF: 84.3, reformaPorcentaje: 0.0 },
  "2025-07": { uf: 39180.00, utm: 68923, topeImponibleUF: 84.3, reformaPorcentaje: 0.0 },
  "2025-06": { uf: 39020.00, utm: 68785, topeImponibleUF: 84.3, reformaPorcentaje: 0.0 },
  "2025-05": { uf: 38810.00, utm: 68648, topeImponibleUF: 84.3, reformaPorcentaje: 0.0 },
  "2025-04": { uf: 38620.00, utm: 68306, topeImponibleUF: 84.3, reformaPorcentaje: 0.0 },
  "2025-03": { uf: 38480.00, utm: 68034, topeImponibleUF: 84.3, reformaPorcentaje: 0.0 },
  "2025-02": { uf: 38410.00, utm: 67294, topeImponibleUF: 84.3, reformaPorcentaje: 0.0 },
  "2025-01": { uf: 38384.41, utm: 67429, topeImponibleUF: 81.6, reformaPorcentaje: 0.0 }
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

const LRE_HEADERS = [
  "Rut trabajador(1101)",
  "Fecha inicio contrato(1102)",
  "Fecha término de contrato(1103)",
  "Causal término de contrato(1104)",
  "Región prestación de servicios(1105)",
  "Comuna prestación de servicios(1106)",
  "Tipo impuesto a la renta(1170)",
  "Técnico extranjero exención cot. previsionales(1146)",
  "Código tipo de jornada(1107)",
  "Persona con Discapacidad - Pensionado por Invalidez(1108)",
  "Pensionado por vejez(1109)",
  "AFP(1141)",
  "IPS (ExINP)(1142)",
  "FONASA - ISAPRE(1143)",
  "AFC(1151)",
  "CCAF(1110)",
  "Org. administrador ley 16.744(1152)",
  "Nro cargas familiares legales autorizadas(1111)",
  "Nro de cargas familiares maternales(1112)",
  "Nro de cargas familiares invalidez(1113)",
  "Tramo asignación familiar(1114)",
  "Rut org sindical 1(1171)",
  "Rut org sindical 2(1172)",
  "Rut org sindical 3(1173)",
  "Rut org sindical 4(1174)",
  "Rut org sindical 5(1175)",
  "Rut org sindical 6(1176)",
  "Rut org sindical 7(1177)",
  "Rut org sindical 8(1178)",
  "Rut org sindical 9(1179)",
  "Rut org sindical 10(1180)",
  "Nro días trabajados en el mes(1115)",
  "Nro días de licencia médica en el mes(1116)",
  "Nro días de vacaciones en el mes(1117)",
  "Subsidio trabajador joven(1118)",
  "Puesto Trabajo Pesado(1154)",
  "APVI(1155)",
  "APVC(1157)",
  "Indemnización a todo evento(1131)",
  "Tasa indemnización a todo evento(1132)",
  "Sueldo(2101)",
  "Sobresueldo(2102)",
  "Comisiones(2103)",
  "Semana corrida(2104)",
  "Participación(2105)",
  "Gratificación(2106)",
  "Recargo 30% día domingo(2107)",
  "Remun. variable pagada en vacaciones(2108)",
  "Remun. variable pagada en clausura(2109)",
  "Aguinaldo(2110)",
  "Bonos u otras remun. fijas mensuales(2111)",
  "Tratos(2112)",
  "Bonos u otras remun. variables mensuales o superiores a un mes(2113)",
  "Ejercicio opción no pactada en contrato(2114)",
  "Beneficios en especie constitutivos de remun(2115)",
  "Remuneraciones bimestrales(2116)",
  "Remuneraciones trimestrales(2117)",
  "Remuneraciones cuatrimestral(2118)",
  "Remuneraciones semestrales(2119)",
  "Remuneraciones anuales(2120)",
  "Participación anual(2121)",
  "Gratificación anual(2122)",
  "Otras remuneraciones superiores a un mes(2123)",
  "Pago por horas de trabajo sindical(2124)",
  "Sueldo empresarial (2161)",
  "Subsidio por incapacidad laboral por licencia médica(2201)",
  "Beca de estudio(2202)",
  "Gratificaciones de zona(2203)",
  "Otros ingresos no constitutivos de renta(2204)",
  "Colación(2301)",
  "Movilización(2302)",
  "Viáticos(2303)",
  "Asignación de pérdida de caja(2304)",
  "Asignación de desgaste herramienta(2305)",
  "Asignación familiar legal(2311)",
  "Gastos por causa del trabajo(2306)",
  "Gastos por cambio de residencia(2307)",
  "Sala cuna(2308)",
  "Asignación trabajo a distancia o teletrabajo(2309)",
  "Depósito convenido hasta UF 900(2347)",
  "Alojamiento por razones de trabajo(2310)",
  "Asignación de traslación(2312)",
  "Indemnización por feriado legal(2313)",
  "Indemnización años de servicio(2314)",
  "Indemnización sustitutiva del aviso previo(2315)",
  "Indemnización fuero maternal(2316)",
  "Pago indemnización a todo evento(2331)",
  "Indemnizaciones voluntarias tributables(2417)",
  "Indemnizaciones contractuales tributables(2418)",
  "Cotización obligatoria previsional (AFP o IPS)(3141)",
  "Cotización obligatoria salud 7%(3143)",
  "Cotización voluntaria para salud(3144)",
  "Cotización AFC - trabajador(3151)",
  "Cotizaciones técnico extranjero para seguridad social fuera de Chile(3146)",
  "Descuento depósito convenido hasta UF 900 anual(3147)",
  "Cotización APVi Mod A(3155)",
  "Cotización APVi Mod B hasta UF50(3156)",
  "Cotización APVc Mod A(3157)",
  "Cotización APVc Mod B hasta UF50(3158)",
  "Impuesto retenido por remuneraciones(3161)",
  "Impuesto retenido por indemnizaciones(3162)",
  "Mayor retención de impuestos solicitada por el trabajador(3163)",
  "Impuesto retenido por reliquidación remun. devengadas otros períodos(3164)",
  "Diferencia impuesto reliquidación remun. devengadas en este período(3165)",
  "Retención préstamo clase media 2020 (Ley 21.252) (3166)",
  "Rebaja zona extrema DL 889 (3167)",
  "Cuota sindical 1(3171)",
  "Cuota sindical 2(3172)",
  "Cuota sindical 3(3173)",
  "Cuota sindical 4(3174)",
  "Cuota sindical 5(3175)",
  "Cuota sindical 6(3176)",
  "Cuota sindical 7(3177)",
  "Cuota sindical 8(3178)",
  "Cuota sindical 9(3179)",
  "Cuota sindical 10(3180)",
  "Crédito social CCAF(3110)",
  "Cuota vivienda o educación(3181)",
  "Crédito cooperativas de ahorro(3182)",
  "Otros descuentos autorizados y solicitados por el trabajador(3183)",
  "Cotización adicional trabajo pesado - trabajador(3154)",
  "Donaciones culturales y de reconstrucción(3184)",
  "Otros descuentos(3185)",
  "Pensiones de alimentos(3186)",
  "Descuento mujer casada(3187)",
  "Descuentos por anticipos y préstamos(3188)",
  "AFC - Aporte empleador(4151)",
  "Aporte empleador seguro accidentes del trabajo y Ley SANNA(4152)",
  "Aporte empleador indemnización a todo evento(4131)",
  "Aporte adicional trabajo pesado - empleador(4154)",
  "Aporte empleador seguro invalidez y sobrevivencia(4155)",
  "APVC - Aporte Empleador(4157)",
  "Total haberes(5201)",
  "Total haberes imponibles y tributables(5210)",
  "Total haberes imponibles no tributables(5220)",
  "Total haberes no imponibles y no tributables(5230)",
  "Total haberes no imponibles y tributables(5240)",
  "Total descuentos(5301)",
  "Total descuentos impuestos a las remuneraciones(5361)",
  "Total descuentos impuestos por indemnizaciones(5362)",
  "Total descuentos por cotizaciones del trabajador(5341)",
  "Total otros descuentos(5302)",
  "Total aportes empleador(5410)",
  "Total líquido(5501)",
  "Total indemnizaciones(5502)",
  "Total indemnizaciones tributables(5564)",
  "Total indemnizaciones no tributables(5565)"
];

export default function SueldoEmpresarialPage() {
  const [formData, setFormData] = useState({
    rutEmpresa: "77.567.348-6",
    razonSocial: "Ecomoving SpA",
    rutTrabajador: "11.275.482-2",
    nombreTrabajador: "Mario Alejandro Osorio Cáceres",
    mesAnio: "2026-07",
    sueldoBruto: 1500000,
    cotizaAFP: true,
    afpSeleccionada: "modelo",
    afpTasaCustom: 10.58,
    cotizaSalud: true,
    tipoSalud: "fonasa" as "fonasa" | "isapre",
    isapreUF: 0,
    colacion: 0,
    movilizacion: 0,
    otrosDescuentos: 0
  });

  // Parámetros económicos configurables
  const [parametrosPeriodo, setParametrosPeriodo] = useState({
    uf: VALORES_OFICIALES["2026-07"].uf,
    utm: VALORES_OFICIALES["2026-07"].utm,
    topeImponibleUF: VALORES_OFICIALES["2026-07"].topeImponibleUF,
    reformaPorcentaje: VALORES_OFICIALES["2026-07"].reformaPorcentaje
  });

  const [valoresConfirmados, setValoresConfirmados] = useState(false);
  const [historial, setHistorial] = useState<Liquidacion[]>([]);
  const [calculoActivo, setCalculoActivo] = useState<Liquidacion | null>(null);

  useEffect(() => {
    cargarLiquidaciones();
  }, []);

  const cargarLiquidaciones = async () => {
    try {
      const { data, error } = await supabase
        .from("liquidaciones_sueldo")
        .select("*")
        .order("mes_anio", { ascending: false });

      if (error) throw error;

      if (data) {
        const mapped: Liquidacion[] = data.map((item: any) => ({
          id: item.id,
          fechaRegistro: new Date(item.created_at).toLocaleDateString("es-CL"),
          rutEmpresa: item.rut_empresa,
          razonSocial: item.razon_social,
          rutTrabajador: item.rut_trabajador,
          nombreTrabajador: item.nombre_trabajador,
          mesAnio: item.mes_anio,
          sueldoBruto: Number(item.sueldo_bruto),
          cotizaAFP: item.cotiza_afp,
          afpSeleccionada: item.afp_seleccionada,
          afpTasaCustom: Number(item.afp_tasa_custom),
          cotizaSalud: item.cotiza_salud,
          tipoSalud: item.tipo_salud,
          isapreUF: Number(item.isapre_uf),
          colacion: Number(item.colacion),
          movilizacion: Number(item.movilizacion),
          otrosDescuentos: Number(item.otros_descuentos),
          ufUsada: Number(item.uf_usada),
          utmUsada: Number(item.utm_usada),
          topeImponibleUFUsado: Number(item.tope_imponible_uf_usado),
          reformaPorcentajeUsado: Number(item.reforma_porcentaje_usado),
          imponible: Number(item.imponible),
          descuentoAFP: Number(item.descuento_afp),
          descuentoSalud: Number(item.descuento_salud),
          baseImpuesto: Number(item.base_impuesto),
          impuestoUnico: Number(item.impuesto_unico),
          sueldoLiquido: Number(item.sueldo_liquido),
          costoEmpresa: Number(item.costo_empresa)
        }));
        setHistorial(mapped);
      }
    } catch (e) {
      console.error("Error al cargar desde Supabase, usando localStorage como fallback:", e);
      const saved = localStorage.getItem("historial_liquidaciones");
      if (saved) {
        try {
          setHistorial(JSON.parse(saved));
        } catch (err) {
          console.error("Error al parsear localStorage", err);
        }
      }
    }
  };

  const formatCLP = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0
    }).format(Math.round(value));
  };

  const formatearRut = (rut: string) => {
    let valor = rut.replace(/\./g, "").replace(/-/g, "");
    if (valor.length < 2) return valor;
    
    let cuerpo = valor.slice(0, -1);
    let dv = valor.slice(-1).toUpperCase();
    
    cuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${cuerpo}-${dv}`;
  };

  const handleExportarLRE = () => {
    if (!calculoActivo) return;

    const afpMap: Record<string, string> = {
      habitat: "103",
      capital: "102",
      cuprum: "104",
      planvital: "105",
      provida: "106",
      modelo: "108",
      uno: "109"
    };

    const afpCodigo = afpMap[calculoActivo.afpSeleccionada] || "108";
    const saludCodigo = calculoActivo.tipoSalud === "fonasa" ? "102" : "103";
    const rutLimpio = calculoActivo.rutTrabajador.replace(/\./g, "").trim();

    const rowValues = Array(147).fill("0");

    rowValues[0] = rutLimpio; // Rut trabajador(1101)
    rowValues[1] = "01-10-2025"; // Fecha inicio contrato(1102)
    rowValues[2] = ""; // Fecha término de contrato(1103)
    rowValues[3] = ""; // Causal término de contrato(1104)
    rowValues[4] = "13"; // Región prestación de servicios(1105)
    rowValues[5] = "13118"; // Comuna prestación de servicios(1106)
    rowValues[6] = "1"; // Tipo impuesto a la renta(1170)
    rowValues[7] = ""; // Técnico extranjero exención
    rowValues[8] = "101"; // Código tipo de jornada(1107)
    rowValues[9] = "0"; // Persona con Discapacidad
    rowValues[10] = "0"; // Pensionado por vejez
    rowValues[11] = afpCodigo; // AFP(1141)
    rowValues[12] = "0"; // IPS (ExINP)(1142)
    rowValues[13] = saludCodigo; // FONASA - ISAPRE(1143)
    rowValues[14] = "0"; // AFC(1151)
    rowValues[15] = "0"; // CCAF(1110)
    rowValues[16] = "1"; // Org. administrador ley 16.744(1152)
    rowValues[17] = "0"; // Nro cargas familiares
    rowValues[18] = "0";
    rowValues[19] = "0";
    rowValues[20] = "S"; // Tramo asignación familiar(1114)
    rowValues[31] = "30"; // Nro días trabajados en el mes(1115)
    
    // Sueldo empresarial (2161)
    rowValues[64] = String(Math.round(calculoActivo.sueldoBruto));

    // Asignaciones
    rowValues[69] = String(Math.round(calculoActivo.colacion || 0)); // Colación(2301)
    rowValues[70] = String(Math.round(calculoActivo.movilizacion || 0)); // Movilización(2302)

    // Cotizaciones
    rowValues[89] = String(Math.round(calculoActivo.descuentoAFP)); // Cotización obligatoria previsional (AFP o IPS)(3141) - Col 90
    rowValues[90] = String(Math.round(calculoActivo.descuentoSalud)); // Cotización obligatoria salud 7%(3143) - Col 91
    rowValues[99] = String(Math.round(calculoActivo.impuestoUnico)); // Impuesto retenido por remuneraciones(3161) - Col 100

    // SIS
    const sisMonto = Math.round(calculoActivo.imponible * 0.0162);
    rowValues[130] = String(sisMonto); // Aporte empleador seguro invalidez y sobrevivencia(4155) - Col 131

    // Totales
    const totalHaberes = Math.round(calculoActivo.sueldoBruto + (calculoActivo.colacion || 0) + (calculoActivo.movilizacion || 0));
    rowValues[132] = String(totalHaberes); // Total haberes(5201) - Col 133
    rowValues[133] = String(Math.round(calculoActivo.sueldoBruto)); // Total haberes imponibles y tributables(5210) - Col 134
    rowValues[134] = "0"; // Total haberes imponibles no tributables(5220) - Col 135
    rowValues[135] = String(Math.round((calculoActivo.colacion || 0) + (calculoActivo.movilizacion || 0))); // Total haberes no imponibles y no tributables(5230) - Col 136
    rowValues[136] = "0"; // Total haberes no imponibles y tributables(5240) - Col 137

    const totalDescuentos = Math.round(calculoActivo.descuentoAFP + calculoActivo.descuentoSalud + calculoActivo.impuestoUnico + (calculoActivo.otrosDescuentos || 0));
    rowValues[137] = String(totalDescuentos); // Total descuentos(5301) - Col 138
    rowValues[138] = String(Math.round(calculoActivo.impuestoUnico)); // Total descuentos impuestos a las remuneraciones(5361) - Col 139
    rowValues[139] = "0"; // Total descuentos impuestos por indemnizaciones(5362) - Col 140
    rowValues[140] = String(Math.round(calculoActivo.descuentoAFP + calculoActivo.descuentoSalud)); // Total descuentos por cotizaciones del trabajador(5341) - Col 141
    rowValues[141] = String(Math.round(calculoActivo.otrosDescuentos || 0)); // Total otros descuentos(5302) - Col 142
    rowValues[142] = String(sisMonto); // Total aportes empleador(5410) - Col 143
    rowValues[143] = String(Math.round(calculoActivo.sueldoLiquido)); // Total líquido(5501) - Col 144

    const csvContent = [
      LRE_HEADERS.join(";"),
      rowValues.join(";")
    ].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `LRE_DT_Ecomoving_${calculoActivo.mesAnio}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMesChange = (mes: string) => {
    setFormData({ ...formData, mesAnio: mes });
    setValoresConfirmados(false);
    
    if (VALORES_OFICIALES[mes]) {
      setParametrosPeriodo({
        uf: VALORES_OFICIALES[mes].uf,
        utm: VALORES_OFICIALES[mes].utm,
        topeImponibleUF: VALORES_OFICIALES[mes].topeImponibleUF,
        reformaPorcentaje: VALORES_OFICIALES[mes].reformaPorcentaje
      });
    } else {
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

  const calcularLiquidacion = (data: typeof formData): Liquidacion => {
    const uf = parametrosPeriodo.uf;
    const utm = parametrosPeriodo.utm;
    const topeImponible = parametrosPeriodo.topeImponibleUF * uf;

    const imponible = Math.min(data.sueldoBruto, topeImponible);

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

    const totalDescuentosPrevisionales = descuentoAFP + descuentoSalud;
    const baseImpuesto = Math.max(0, data.sueldoBruto - totalDescuentosPrevisionales);

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

    const sueldoLiquido = data.sueldoBruto - totalDescuentosPrevisionales - impuestoUnico + data.colacion + data.movilizacion - data.otrosDescuentos;

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
    if (!valoresConfirmados) {
      alert("⚠️ Debe revisar los parámetros económicos (UF, UTM, etc.) del período y marcar la casilla de confirmación para poder generar la liquidación.");
      return;
    }
    const res = calcularLiquidacion(formData);
    setCalculoActivo(res);
  };

  const handleGuardar = async () => {
    if (!calculoActivo) return;
    try {
      const { error } = await supabase.from("liquidaciones_sueldo").insert([{
        rut_empresa: calculoActivo.rutEmpresa,
        razon_social: calculoActivo.razonSocial,
        rut_trabajador: calculoActivo.rutTrabajador,
        nombre_trabajador: calculoActivo.nombreTrabajador,
        mes_anio: calculoActivo.mesAnio,
        sueldo_bruto: calculoActivo.sueldoBruto,
        cotiza_afp: calculoActivo.cotizaAFP,
        afp_seleccionada: calculoActivo.afpSeleccionada,
        afp_tasa_custom: calculoActivo.afpTasaCustom,
        cotiza_salud: calculoActivo.cotizaSalud,
        tipo_salud: calculoActivo.tipoSalud,
        isapre_uf: calculoActivo.isapreUF,
        colacion: calculoActivo.colacion,
        movilizacion: calculoActivo.movilizacion,
        otros_descuentos: calculoActivo.otrosDescuentos,
        uf_usada: calculoActivo.ufUsada,
        utm_usada: calculoActivo.utmUsada,
        tope_imponible_uf_usado: calculoActivo.topeImponibleUFUsado,
        reforma_porcentaje_usado: calculoActivo.reformaPorcentajeUsado,
        imponible: calculoActivo.imponible,
        descuento_afp: calculoActivo.descuentoAFP,
        descuento_salud: calculoActivo.descuentoSalud,
        base_impuesto: calculoActivo.baseImpuesto,
        impuesto_unico: calculoActivo.impuestoUnico,
        sueldo_liquido: calculoActivo.sueldoLiquido,
        costo_empresa: calculoActivo.costoEmpresa
      }]);

      if (error) throw error;

      alert("Liquidación guardada exitosamente en Supabase.");
      cargarLiquidaciones();
    } catch (e) {
      console.error("Error al guardar en Supabase, guardando en local:", e);
      const nuevoId = Math.random().toString(36).substring(2, 9);
      const nuevo = [...historial, { ...calculoActivo, id: nuevoId }];
      setHistorial(nuevo);
      localStorage.setItem("historial_liquidaciones", JSON.stringify(nuevo));
      alert("Se guardó en el historial local (Offline / Falló Supabase).");
    }
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

  const handleEliminarHistorial = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Está seguro de que desea eliminar esta liquidación?")) return;
    try {
      const { error } = await supabase.from("liquidaciones_sueldo").delete().eq("id", id);
      if (error) throw error;

      alert("Liquidación eliminada exitosamente.");
      cargarLiquidaciones();
    } catch (e) {
      console.error("Error al eliminar de Supabase, eliminando en local:", e);
      const filtrado = historial.filter(h => h.id !== id);
      setHistorial(filtrado);
      localStorage.setItem("historial_liquidaciones", JSON.stringify(filtrado));
    }
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
              rutTrabajador: "11.275.482-2",
              nombreTrabajador: "Mario Alejandro Osorio Cáceres",
              sueldoBruto: 1500000,
              colacion: 0,
              movilizacion: 0,
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

        {/* Banner de confirmación obligatoria de parámetros */}
        <div className={`mt-3 flex items-center gap-3 p-3 rounded-lg border transition-all ${
          valoresConfirmados 
            ? 'bg-green-50/70 dark:bg-green-950/20 border-green-200 dark:border-green-900/40 text-green-800 dark:text-green-300' 
            : 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300'
        }`}>
          <Checkbox 
            id="valoresConfirmados" 
            checked={valoresConfirmados} 
            onCheckedChange={(checked) => setValoresConfirmados(checked === true)}
          />
          <Label htmlFor="valoresConfirmados" className="text-xs font-semibold cursor-pointer select-none">
            ⚠️ Confirmo que he revisado e ingresado manualmente los valores de UF, UTM y Tope Imponible del período {formData.mesAnio} para esta liquidación. (Obligatorio)
          </Label>
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
                Registro de liquidaciones guardadas en Supabase (con respaldo local).
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
                <Button 
                  onClick={handleExportarLRE}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Exportar LRE (DT)
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
