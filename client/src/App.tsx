import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import CuentasPage from "./pages/cuentas/CuentasPage";
import CuentaForm from "./pages/cuentas/CuentaForm";
import ContactosPage from "./pages/contactos/ContactosPage";
import ContactoForm from "./pages/contactos/ContactoForm";
import CotizacionesPage from "./pages/cotizaciones/CotizacionesPage";
import CotizacionSelector from "./pages/cotizaciones/CotizacionSelector";
import CotizacionForm from "./pages/cotizaciones/CotizacionForm";
import OportunidadesPage from "./pages/oportunidades/OportunidadesPage";
import OportunidadForm from "./pages/oportunidades/OportunidadForm";
import ConfiguracionKeywords from "./pages/oportunidades/ConfiguracionKeywords";
import VentasPage from "./pages/ventas/VentasPage";
import ComprasPage from "./pages/compras/ComprasPage";
import ConciliacionPage from "./pages/conciliacion/ConciliacionPage";
import Marketing from "./pages/marketing/marketing";

// Build v1.0.1 - Marketing tabs cleaned (2026-01-28)

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          {/* Ventas */}
          <Route path="ventas" element={<VentasPage />} />
          {/* Compras */}
          <Route path="compras" element={<ComprasPage />} />
          {/* Conciliación */}
          <Route path="conciliacion" element={<ConciliacionPage />} />
          {/* Cuentas */}
          <Route path="cuentas" element={<CuentasPage />} />
          <Route path="cuentas/nueva" element={<CuentaForm />} />
          {/* Contactos */}
          <Route path="contactos" element={<ContactosPage />} />
          <Route path="contactos/nuevo" element={<ContactoForm />} />
          <Route path="contactos/:id" element={<ContactoForm />} />
          {/* Cotizaciones */}
          <Route path="cotizaciones" element={<CotizacionesPage />} />
          <Route path="cotizaciones/nueva" element={<CotizacionForm />} />
          <Route
            path="cotizaciones/nueva/:cuentaId/:contactoId"
            element={<CotizacionForm />}
          />
          <Route path="cotizaciones/:id" element={<CotizacionForm />} />
          {/* Oportunidades */}
          <Route path="oportunidades" element={<OportunidadesPage />} />
          <Route path="oportunidades/nueva" element={<OportunidadForm />} />
          <Route path="oportunidades/configuracion" element={<ConfiguracionKeywords />} />
          <Route path="oportunidades/:id" element={<OportunidadForm />} />
          {/* Marketing */}
          <Route path="marketing" element={<Marketing />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
