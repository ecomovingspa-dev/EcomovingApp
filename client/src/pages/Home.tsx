import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

// =============================
// TIPOS
// =============================
interface SubCosto {
  id: string;
  nombre: string;
  valor: number;
}

interface Item {
  id: string;
  descripcion: string;
  cantidad: number;
  margen: number;
  subcostos: SubCosto[];
}

interface Cotizacion {
  id: number;
  numero_cotizacion: string;
  nombre: string;
  ejecutiva_o: string;
  estado_cotizacion: string;
  items: Item[];
}

// =============================
// COMPONENTE
// =============================
export default function Home() {
  // =============================
  // ESTADO GENERAL
  // =============================
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [cotizacionId, setCotizacionId] = useState<number | null>(null);

  const [nombreCotizacion, setNombreCotizacion] = useState("Mi Cotización");
  const [numeroCotizacion, setNumeroCotizacion] = useState("");
  const [ejecutiva, setEjecutiva] = useState("");
  const [estadoCotizacion] = useState("Pendiente");

  const [items, setItems] = useState<Item[]>([]);

  // =============================
  // CARGAR COTIZACIONES
  // =============================
  const cargarCotizaciones = async () => {
    const { data } = await supabase
      .from("cotizaciones")
      .select("*")
      .not("numero_cotizacion", "is", null)
      .order("id", { ascending: false });

    if (data) setCotizaciones(data);
  };

  useEffect(() => {
    cargarCotizaciones();
  }, []);

  // =============================
  // NUMERACIÓN SECUENCIAL
  // =============================
  const generarNumeroCotizacion = async () => {
    const { data } = await supabase
      .from("cotizaciones")
      .select("id")
      .order("id", { ascending: false })
      .limit(1);

    const next = data && data.length ? data[0].id + 1 : 1;
    return `COT-${String(next).padStart(6, "0")}`;
  };

  // =============================
  // CÁLCULOS
  // =============================
  const totales = useMemo(() => {
    let totalCostos = 0;
    let totalVenta = 0;

    items.forEach((item) => {
      const costoUnit = item.subcostos.reduce((a, s) => a + s.valor, 0);
      const costoItem = costoUnit * item.cantidad;
      const ventaItem = costoUnit > 0 ? costoItem / (1 - item.margen / 100) : 0;

      totalCostos += costoItem;
      totalVenta += ventaItem;
    });

    const ganancia = totalVenta - totalCostos;
    const margenTotal = totalVenta > 0 ? (ganancia / totalVenta) * 100 : 0;

    return { totalCostos, totalVenta, ganancia, margenTotal };
  }, [items]);

  // =============================
  // NUEVA COTIZACIÓN
  // =============================
  const nuevaCotizacion = async () => {
    const numero = await generarNumeroCotizacion();
    setCotizacionId(null);
    setNumeroCotizacion(numero);
    setNombreCotizacion("Mi Cotización");
    setEjecutiva("");
    setItems([
      {
        id: crypto.randomUUID(),
        descripcion: "Producto",
        cantidad: 1,
        margen: 25,
        subcostos: [
          { id: crypto.randomUUID(), nombre: "Costo base", valor: 0 },
        ],
      },
    ]);
  };

  // =============================
  // GUARDAR / ACTUALIZAR
  // =============================
  const guardarCotizacion = async () => {
    if (!items.length || totales.totalVenta <= 0) {
      alert("La cotización no tiene valores válidos");
      return;
    }

    const totalNeto = totales.totalVenta;
    const iva = totalNeto * 0.19;
    const total = totalNeto + iva;

    const payload = {
      nombre: nombreCotizacion,
      numero_cotizacion: numeroCotizacion,
      ejecutiva_o: ejecutiva,
      estado_cotizacion: estadoCotizacion,
      items,
      costo_total: totales.totalCostos,
      total_neto: totalNeto,
      iva,
      total,
      ganancias: totales.ganancia,
      mg: totales.margenTotal.toFixed(2),
    };

    const res = cotizacionId
      ? await supabase
          .from("cotizaciones")
          .update(payload)
          .eq("id", cotizacionId)
      : await supabase.from("cotizaciones").insert([payload]);

    if (res.error) {
      console.error(res.error);
      alert("Error al guardar");
      return;
    }

    alert("Cotización guardada");
    cargarCotizaciones();
  };

  // =============================
  // UI
  // =============================
  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <h1>Cotización</h1>

      <button onClick={nuevaCotizacion}>+ Nueva cotización</button>

      <h3>Cotizaciones guardadas</h3>
      {cotizaciones.map((c) => (
        <div
          key={c.id}
          style={{ cursor: "pointer" }}
          onClick={() => {
            setCotizacionId(c.id);
            setNumeroCotizacion(c.numero_cotizacion);
            setNombreCotizacion(c.nombre);
            setEjecutiva(c.ejecutiva_o);
            setItems(c.items || []);
          }}
        >
          {c.numero_cotizacion} — {c.nombre}
        </div>
      ))}

      <hr />

      <b>{numeroCotizacion}</b>

      <input
        placeholder="Ejecutiva / Vendedor"
        value={ejecutiva}
        onChange={(e) => setEjecutiva(e.target.value)}
      />

      <input
        placeholder="Nombre cotización"
        value={nombreCotizacion}
        onChange={(e) => setNombreCotizacion(e.target.value)}
      />

      <button onClick={guardarCotizacion}>
        {cotizacionId ? "Actualizar" : "Guardar"} cotización
      </button>

      <hr />

      <h3>Totales</h3>
      <p>Costo total: ${totales.totalCostos.toFixed(0)}</p>
      <p>Total venta neto: ${totales.totalVenta.toFixed(0)}</p>
      <p>Ganancia: ${totales.ganancia.toFixed(0)}</p>
      <p>Margen total: {totales.margenTotal.toFixed(2)}%</p>
    </div>
  );
}
