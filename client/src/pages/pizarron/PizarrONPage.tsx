import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  CalendarDays, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Edit3, 
  Play, 
  Check, 
  User, 
  FileText, 
  Sparkles,
  AlertTriangle
} from "lucide-react";

interface Tarea {
  id: string;
  titulo: string;
  descripcion: string;
  estado: "pendiente" | "en_proceso" | "completado";
  prioridad: "baja" | "media" | "alta";
  fecha_limite: string;
  creado_por: string;
  creado_en: string;
}

export default function PizarrONPage() {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Date State for daily scheduling
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  
  // Form State
  const [showModal, setShowModal] = useState(false);
  const [editingTarea, setEditingTarea] = useState<Tarea | null>(null);
  const [formTitulo, setFormTitulo] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPrioridad, setFormPrioridad] = useState<"baja" | "media" | "alta">("media");
  const [formFecha, setFormFecha] = useState(selectedDate);
  const [formCreador, setFormCreador] = useState("");
  
  // Load tasks on mount and set up Realtime subscription
  useEffect(() => {
    cargarTareas();

    const channel = supabase
      .channel("realtime-tareas")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gestion_tareas" },
        () => {
          cargarTareas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Sync form date with selected date when opening modal for a new task
  useEffect(() => {
    if (!editingTarea) {
      setFormFecha(selectedDate);
    }
  }, [selectedDate, editingTarea, showModal]);

  const cargarTareas = async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from("gestion_tareas")
        .select("*")
        .order("creado_en", { ascending: false });

      if (error) throw error;
      setTareas(data || []);
    } catch (e: any) {
      console.error("Error al cargar tareas:", e);
      setErrorMsg("Error al conectar con la base de datos: " + e.message);
    } finally {
      setCargando(false);
    }
  };

  // Generate an array of 7 days around the selected date for the slider
  const daysRange = useMemo(() => {
    const range = [];
    const baseDate = new Date(selectedDate + "T12:00:00");
    for (let i = -3; i <= 3; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;
      range.push({
        dateStr,
        dayName: d.toLocaleDateString("es-ES", { weekday: "short" }),
        dayNum: d.getDate(),
        monthName: d.toLocaleDateString("es-ES", { month: "short" }),
        isToday: new Date().toISOString().split("T")[0] === dateStr
      });
    }
    return range;
  }, [selectedDate]);

  // Tasks categorized for the active selected day
  const activeTareas = useMemo(() => {
    return tareas.filter((t) => t.fecha_limite === selectedDate);
  }, [tareas, selectedDate]);

  // Overdue and incomplete tasks (scheduled before today and not completed)
  const overdueTareas = useMemo(() => {
    const hoyStr = new Date().toISOString().split("T")[0];
    return tareas.filter((t) => t.fecha_limite < hoyStr && t.estado !== "completado");
  }, [tareas]);

  // Counters for the active day columns
  const stats = useMemo(() => {
    const counts = { pendiente: 0, en_proceso: 0, completado: 0 };
    activeTareas.forEach((t) => {
      if (counts[t.estado] !== undefined) {
        counts[t.estado]++;
      }
    });
    return counts;
  }, [activeTareas]);

  // Handler for adding/updating task
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitulo.trim()) return;

    const payload = {
      titulo: formTitulo,
      descripcion: formDesc,
      prioridad: formPrioridad,
      fecha_limite: formFecha,
      creado_por: formCreador.trim() || "Usuario Ecomoving",
    };

    try {
      if (editingTarea) {
        const { error } = await supabase
          .from("gestion_tareas")
          .update(payload)
          .eq("id", editingTarea.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("gestion_tareas")
          .insert([payload]);
        if (error) throw error;
      }
      setShowModal(false);
      resetForm();
      cargarTareas();
    } catch (e: any) {
      console.error("Error al guardar tarea:", e);
      alert("Error al guardar: " + e.message);
    }
  };

  const resetForm = () => {
    setEditingTarea(null);
    setFormTitulo("");
    setFormDesc("");
    setFormPrioridad("media");
    setFormFecha(selectedDate);
    setFormCreador("");
  };

  const handleEditClick = (tarea: Tarea) => {
    setEditingTarea(tarea);
    setFormTitulo(tarea.titulo);
    setFormDesc(tarea.descripcion || "");
    setFormPrioridad(tarea.prioridad);
    setFormFecha(tarea.fecha_limite);
    setFormCreador(tarea.creado_por);
    setShowModal(true);
  };

  const handleUpdateStatus = async (id: string, nuevoEstado: "pendiente" | "en_proceso" | "completado") => {
    try {
      const { error } = await supabase
        .from("gestion_tareas")
        .update({ estado: nuevoEstado })
        .eq("id", id);
      if (error) throw error;
      cargarTareas();
    } catch (e: any) {
      console.error("Error al actualizar estado:", e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta tarea programada?")) return;
    try {
      const { error } = await supabase
        .from("gestion_tareas")
        .delete()
        .eq("id", id);
      if (error) throw error;
      cargarTareas();
    } catch (e: any) {
      console.error("Error al eliminar:", e);
    }
  };

  const navigateDay = (direction: number) => {
    const current = new Date(selectedDate + "T12:00:00");
    current.setDate(current.getDate() + direction);
    setSelectedDate(current.toISOString().split("T")[0]);
  };

  const handleGoToday = () => {
    setSelectedDate(new Date().toISOString().split("T")[0]);
  };

  const getPriorityBadgeStyle = (prioridad: string) => {
    switch (prioridad) {
      case "alta":
        return "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50";
      case "media":
        return "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50";
      default:
        return "bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-900/50";
    }
  };

  const getCardBorderStyle = (prioridad: string, estado: string) => {
    if (estado === "completado") return "border-gray-200 dark:border-gray-700 opacity-60";
    switch (prioridad) {
      case "alta":
        return "border-l-4 border-l-rose-500 border-gray-200 dark:border-gray-700 hover:shadow-rose-100 dark:hover:shadow-none";
      case "media":
        return "border-l-4 border-l-amber-500 border-gray-200 dark:border-gray-700 hover:shadow-amber-100 dark:hover:shadow-none";
      default:
        return "border-l-4 border-l-sky-500 border-gray-200 dark:border-gray-700 hover:shadow-sky-100 dark:hover:shadow-none";
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <CalendarDays className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            Pizarrón Digital
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Planificación diaria y gestión colaborativa de tareas pendientes para Ecomoving SpA
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleGoToday}
            className="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold"
          >
            Hoy
          </Button>
          <Button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-md font-semibold"
          >
            <Plus className="mr-2 h-4.5 w-4.5" /> Agregar Pendiente
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-xl flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Daily Scheduling Slider Panel */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-amber-500" /> Agenda Semanal
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigateDay(-1)}
              className="p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300 min-w-[120px] text-center">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("es-ES", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
            <button
              onClick={() => navigateDay(1)}
              className="p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Day Selector Buttons Row */}
        <div className="grid grid-cols-7 gap-2">
          {daysRange.map((d) => {
            const isSelected = d.dateStr === selectedDate;
            const dayTareas = tareas.filter((t) => t.fecha_limite === d.dateStr && t.estado !== "completado");
            const hasPending = dayTareas.length > 0;

            return (
              <button
                key={d.dateStr}
                onClick={() => setSelectedDate(d.dateStr)}
                className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all relative ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25 scale-102 font-bold"
                    : "bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 hover:scale-101 border border-transparent dark:border-gray-800"
                }`}
              >
                <span className={`text-[10px] uppercase ${isSelected ? "text-blue-100" : "text-gray-400"}`}>
                  {d.dayName}
                </span>
                <span className="text-xl font-extrabold my-0.5">{d.dayNum}</span>
                <span className={`text-[9px] capitalize ${isSelected ? "text-blue-100" : "text-gray-400"}`}>
                  {d.monthName}
                </span>

                {/* Day status badge indicators */}
                {hasPending && (
                  <span className={`absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isSelected 
                      ? "bg-white text-blue-600 border border-blue-600 shadow-sm" 
                      : "bg-rose-500 text-white"
                  }`}>
                    {dayTareas.length}
                  </span>
                )}
                {d.isToday && !isSelected && (
                  <span className="absolute bottom-1 w-1.5 h-1.5 bg-blue-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Alerts Panel: Overdue Tasks Alert */}
      {overdueTareas.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 dark:bg-rose-900/40 rounded-xl text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-rose-800 dark:text-rose-300 text-sm">
                ¡Tienes {overdueTareas.length} tareas pendientes de días anteriores!
              </h4>
              <p className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                Revisa y reprograma o marca como completadas para mantener la agenda diaria al día.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              // Set selected date to the date of the oldest overdue task to review it
              const oldestOverdue = [...overdueTareas].sort((a,b) => a.fecha_limite.localeCompare(b.fecha_limite))[0];
              if (oldestOverdue) setSelectedDate(oldestOverdue.fecha_limite);
            }}
            className="text-xs font-bold text-rose-700 hover:text-rose-800 dark:text-rose-300 dark:hover:text-rose-200 bg-white dark:bg-gray-800 border border-rose-200 dark:border-rose-800/80 px-3 py-1.5 rounded-lg shadow-sm transition-all whitespace-nowrap"
          >
            Ir a tareas vencidas
          </button>
        </div>
      )}

      {/* Kanban Board Columns for selected day */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMN 1: PENDIENTES */}
        <div className="bg-gray-50/50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 p-5 rounded-2xl flex flex-col min-h-[450px]">
          <div className="flex items-center justify-between pb-3 border-b border-gray-200/50 dark:border-gray-700/50 mb-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/30" />
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-base">Pendientes</h3>
            </div>
            <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-md">
              {stats.pendiente}
            </span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto max-h-[550px] pr-1">
            {activeTareas.filter(t => t.estado === "pendiente").length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-4 text-gray-400 dark:text-gray-500">
                <Clock className="h-6 w-6 stroke-1 mb-1.5" />
                <span className="text-xs font-medium">Sin tareas pendientes para hoy</span>
              </div>
            ) : (
              activeTareas.filter(t => t.estado === "pendiente").map(tarea => (
                <div 
                  key={tarea.id}
                  className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border hover:shadow-md transition-all group relative ${getCardBorderStyle(tarea.prioridad, tarea.estado)}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded-md ${getPriorityBadgeStyle(tarea.prioridad)}`}>
                      {tarea.prioridad}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEditClick(tarea)}
                        className="p-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-blue-500"
                        title="Editar tarea"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(tarea.id)}
                        className="p-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-red-500"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-tight mb-1">
                    {tarea.titulo}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                    {tarea.descripcion || "Sin descripción"}
                  </p>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                      <User className="h-3 w-3 shrink-0" /> {tarea.creado_por}
                    </span>
                    <button
                      onClick={() => handleUpdateStatus(tarea.id, "en_proceso")}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-0.5 hover:underline"
                    >
                      Iniciar <Play className="h-3 w-3 fill-current" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMN 2: EN PROCESO */}
        <div className="bg-gray-50/50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 p-5 rounded-2xl flex flex-col min-h-[450px]">
          <div className="flex items-center justify-between pb-3 border-b border-gray-200/50 dark:border-gray-700/50 mb-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500/30" />
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-base">En Proceso</h3>
            </div>
            <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 rounded-md">
              {stats.en_proceso}
            </span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto max-h-[550px] pr-1">
            {activeTareas.filter(t => t.estado === "en_proceso").length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-4 text-gray-400 dark:text-gray-500">
                <Play className="h-5 w-5 stroke-1 mb-1.5" />
                <span className="text-xs font-medium">Ningún pendiente activo hoy</span>
              </div>
            ) : (
              activeTareas.filter(t => t.estado === "en_proceso").map(tarea => (
                <div 
                  key={tarea.id}
                  className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border hover:shadow-md transition-all group relative ${getCardBorderStyle(tarea.prioridad, tarea.estado)}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded-md ${getPriorityBadgeStyle(tarea.prioridad)}`}>
                      {tarea.prioridad}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEditClick(tarea)}
                        className="p-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-blue-500"
                        title="Editar tarea"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(tarea.id)}
                        className="p-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-red-500"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-tight mb-1">
                    {tarea.titulo}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                    {tarea.descripcion || "Sin descripción"}
                  </p>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                      <User className="h-3 w-3 shrink-0" /> {tarea.creado_por}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateStatus(tarea.id, "pendiente")}
                        className="text-[10px] font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      >
                        Pausar
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(tarea.id, "completado")}
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-0.5 hover:underline"
                      >
                        Terminar <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMN 3: COMPLETADAS */}
        <div className="bg-gray-50/50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 p-5 rounded-2xl flex flex-col min-h-[450px]">
          <div className="flex items-center justify-between pb-3 border-b border-gray-200/50 dark:border-gray-700/50 mb-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/30" />
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-base">Completado</h3>
            </div>
            <span className="px-2 py-0.5 text-xs font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-md">
              {stats.completado}
            </span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto max-h-[550px] pr-1">
            {activeTareas.filter(t => t.estado === "completado").length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-4 text-gray-400 dark:text-gray-500">
                <CheckCircle2 className="h-6 w-6 stroke-1 mb-1.5" />
                <span className="text-xs font-medium">Ningún pendiente completado aún hoy</span>
              </div>
            ) : (
              activeTareas.filter(t => t.estado === "completado").map(tarea => (
                <div 
                  key={tarea.id}
                  className={`bg-white/70 dark:bg-gray-800/70 p-4 rounded-xl shadow-sm border transition-all group relative ${getCardBorderStyle(tarea.prioridad, tarea.estado)}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 text-[8px] font-bold uppercase rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                      Listo
                    </span>
                    <button 
                      onClick={() => handleDelete(tarea.id)}
                      className="p-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <h4 className="font-semibold text-gray-500 dark:text-gray-400 text-sm leading-tight mb-1 line-through decoration-gray-400">
                    {tarea.titulo}
                  </h4>
                  <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-1 italic">
                    {tarea.descripcion || "Sin descripción"}
                  </p>

                  <div className="flex items-center justify-between mt-4 pt-2 border-t border-gray-100/50 dark:border-gray-700/30">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      Terminada
                    </span>
                    <button
                      onClick={() => handleUpdateStatus(tarea.id, "en_proceso")}
                      className="text-[10px] text-blue-500 hover:underline hover:text-blue-600"
                    >
                      Reabrir
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* GLASSMORPHISM FORM MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
              <h3 className="font-extrabold text-gray-900 dark:text-gray-100 text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                {editingTarea ? "Editar Pendiente" : "Planificar Nueva Tarea"}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  Título de la tarea
                </label>
                <Input
                  type="text"
                  required
                  placeholder="Ej: Revisar conciliación o despachar facturas..."
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  Descripción / Detalles
                </label>
                <textarea
                  placeholder="Detalles sobre lo que se necesita hacer..."
                  rows={3}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                    Prioridad
                  </label>
                  <select
                    value={formPrioridad}
                    onChange={(e) => setFormPrioridad(e.target.value as any)}
                    className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 text-sm text-gray-950 dark:text-gray-100"
                  >
                    <option value="baja">Baja (Celeste)</option>
                    <option value="media">Media (Amarillo)</option>
                    <option value="alta">Alta (Rojo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                    Fecha Programada
                  </label>
                  <Input
                    type="date"
                    required
                    value={formFecha}
                    onChange={(e) => setFormFecha(e.target.value)}
                    className="w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  Asignar a / Creador
                </label>
                <Input
                  type="text"
                  placeholder="Nombre de la persona a cargo..."
                  value={formCreador}
                  onChange={(e) => setFormCreador(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Form Actions */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  className="border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold shadow-md"
                >
                  {editingTarea ? "Guardar Cambios" : "Programar Pendiente"}
                </Button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
