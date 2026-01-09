import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

interface Vendedor {
  id: string;
  nombre: string;
}

export function useVendedores() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarVendedores = async () => {
    try {
      setCargando(true);
      setError(null);

      const { data, error: err } = await supabase
        .from("vendedores")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre");

      if (err) throw err;

      setVendedores(data || []);
    } catch (err: any) {
      console.error("Error cargando vendedores:", err);
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarVendedores();
  }, []);

  return { vendedores, cargando, error, recargar: cargarVendedores };
}
