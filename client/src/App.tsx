import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import Layout from "./components/Layout";

// Lazy-loaded components
const Home = lazy(() => import("./pages/Home"));
const CuentasPage = lazy(() => import("./pages/cuentas/CuentasPage"));
const CuentaForm = lazy(() => import("./pages/cuentas/CuentaForm"));
const ContactosPage = lazy(() => import("./pages/contactos/ContactosPage"));
const ContactoForm = lazy(() => import("./pages/contactos/ContactoForm"));
const CotizacionesPage = lazy(() => import("./pages/cotizaciones/CotizacionesPage"));
const CotizacionForm = lazy(() => import("./pages/cotizaciones/CotizacionForm"));
const OportunidadesPage = lazy(() => import("./pages/oportunidades/OportunidadesPage"));
const OportunidadForm = lazy(() => import("./pages/oportunidades/OportunidadForm"));
const ConfiguracionKeywords = lazy(() => import("./pages/oportunidades/ConfiguracionKeywords"));
const VentasPage = lazy(() => import("./pages/ventas/VentasPage"));
const ComprasPage = lazy(() => import("./pages/compras/ComprasPage"));
const ConciliacionPage = lazy(() => import("./pages/conciliacion/ConciliacionPage"));
const Marketing = lazy(() => import("./pages/marketing/marketing"));
const PackingPage = lazy(() => import("./pages/logistica/PackingPage"));
const PizarrONPage = lazy(() => import("./pages/pizarron/PizarrONPage"));
const SueldoEmpresarialPage = lazy(() => import("./pages/remuneraciones/SueldoEmpresarialPage"));





// Build v1.0.1 - Marketing tabs cleaned (2026-01-28)

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Cargando aplicación...</p>
          </div>
        </div>
      }>
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
            <Route path="cuentas/editar/:id" element={<CuentaForm />} />
            {/* Contactos */}
            <Route path="contactos" element={<ContactosPage />} />
            <Route path="contactos/nuevo" element={<ContactoForm />} />
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
            <Route path="oportunidades/configuracion" element={<ConfiguracionKeywords />} />

            {/* Marketing */}
            <Route path="marketing" element={<Marketing />} />

            {/* Pizarrón */}
            <Route path="pizarron" element={<PizarrONPage />} />

            {/* Logística - Packing */}
            <Route path="packing" element={<PackingPage />} />

            {/* Remuneraciones */}
            <Route path="remuneraciones" element={<SueldoEmpresarialPage />} />
          </Route>

        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

