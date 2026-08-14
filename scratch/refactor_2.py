import re

with open("scratch_cuentas.txt", "r", encoding="utf-8") as f:
    cuentas = f.read()

with open("client/src/pages/marketing/TrazabilidadBrevo.tsx", "r", encoding="utf-8") as f:
    traz = f.read()

# 1. Extract Zoho Handlers
# from `const startEditingTemplate` down to `const formatToInputDate` or `handleSelectTemplate`
# Actually, I'll extract these manually in python using regex or string splits
handlers_code = ""

start_marker = "const startEditingTemplate ="
end_marker = "const cargarEstadisticasProspeccion ="
s_idx = cuentas.find(start_marker)
e_idx = cuentas.find(end_marker)
if s_idx != -1 and e_idx != -1:
    handlers_code = cuentas[s_idx:e_idx]

# I also need `abrirModalZoho` which is inside `handlers_code`. But wait, in `CuentasPage` it's defined:
# `const abrirModalZoho = (contacto: any, cuenta: any) => { ... }`
# `abrirModalZoho` should be modified to work with `TrazabilidadBrevo` (e.g. `await cargarCuentas()` -> `await fetchContactos(calendarDays)`).

handlers_code = handlers_code.replace("await cargarCuentas();", "await fetchContactos(calendarDays);")

# I need the `getTemplateStatus` and `renderTemplateCell` which I will just append to handlers.
matrix_logic = """
  const getTemplateStatus = (contacto: any, template: any, nextTemplate: any) => {
    const sentEvent = contacto.historial?.find((h: any) => h.mensaje_id?.startsWith(`manual_send:${template.id}:`) || h.mensaje_id?.startsWith(`manual_template:${template.id}:`));
    const openEvent = contacto.historial?.find((h: any) => h.mensaje_id?.startsWith(`manual_open:${contacto.id}:${template.id}:`));

    let finalOpenEvent = openEvent;
    if (!finalOpenEvent && sentEvent) {
      const sentTime = new Date(sentEvent.created_at || sentEvent.fecha).getTime();
      const nextSentEvent = nextTemplate ? contacto.historial?.find((h: any) => h.mensaje_id?.startsWith(`manual_send:${nextTemplate.id}:`) || h.mensaje_id?.startsWith(`manual_template:${nextTemplate.id}:`)) : null;
      const nextSentTime = nextSentEvent ? new Date(nextSentEvent.created_at || nextSentEvent.fecha).getTime() : Infinity;

      finalOpenEvent = contacto.historial?.find((h: any) => 
        (h.estado === 'opened' || h.estado === 'unique_opened' || h.estado === 'clicks' || h.estado === 'loadedbyproxy') && 
        new Date(h.created_at || h.fecha).getTime() >= sentTime &&
        new Date(h.created_at || h.fecha).getTime() < nextSentTime
      );
    }

    if (finalOpenEvent) {
      return { 
        status: 'opened', 
        sendDate: sentEvent ? (sentEvent.created_at || sentEvent.fecha) : null,
        openDate: finalOpenEvent.created_at || finalOpenEvent.fecha
      };
    } else if (sentEvent) {
      return { 
        status: 'sent', 
        sendDate: sentEvent.created_at || sentEvent.fecha 
      };
    }
    return { status: 'none' };
  };

  const renderTemplateCell = (statusObj: any) => {
    const formatDate = (dateStr: string) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    if (statusObj.status === 'opened') {
      return (
        <div className="flex flex-col items-center justify-center text-[10px] gap-1">
          <Eye className="h-4 w-4 text-purple-400" />
          <span className="text-purple-300">Abierto</span>
          <span className="text-gray-500 text-[8px]">Env: {formatDate(statusObj.sendDate)}</span>
          <span className="text-gray-500 text-[8px]">Lec: {formatDate(statusObj.openDate)}</span>
        </div>
      );
    } else if (statusObj.status === 'sent') {
      return (
        <div className="flex flex-col items-center justify-center text-[10px] gap-1">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span className="text-emerald-300">Enviado</span>
          <span className="text-gray-500 text-[8px]">Env: {formatDate(statusObj.sendDate)}</span>
        </div>
      );
    } else {
      return (
        <div className="flex flex-col items-center justify-center text-[10px] gap-1 opacity-50">
          <Circle className="h-4 w-4 text-gray-600" />
          <span className="text-gray-500">Sin enviar</span>
        </div>
      );
    }
  };

  const toggleCampanaActiva = async (contacto: any) => {
    const newEstado = contacto.estado === 'activo' ? 'inactivo' : 'activo';
    try {
      const { error } = await supabase.from('contactos').update({ estado: newEstado }).eq('id', contacto.id);
      if (error) throw error;
      toast.success(`Campaña ${newEstado === 'activo' ? 'activada' : 'pausada'} para ${contacto.nombre}`);
      await fetchContactos(calendarDays);
    } catch (err: any) {
      toast.error('Error al cambiar el estado de la campaña');
    }
  };
"""

# Insert handlers before the final return
return_idx = traz.rfind("  return (")
traz = traz[:return_idx] + handlers_code + "\n" + matrix_logic + "\n" + traz[return_idx:]


# 2. Extract Zoho Modal from `CuentasPage`
modal_start = "{/* MODAL DE REDACCION ZOHO */}"
modal_end = "    </div >"
ms_idx = cuentas.find(modal_start)
me_idx = cuentas.find(modal_end, ms_idx)
if ms_idx != -1 and me_idx != -1:
    modal_code = cuentas[ms_idx:me_idx]
    # Inject it before the very last </div> in TrazabilidadBrevo
    traz_end_idx = traz.rfind("    </div>")
    traz = traz[:traz_end_idx] + "\n" + modal_code + "\n" + traz[traz_end_idx:]


# 3. Replace the Table structure in TrazabilidadBrevo
table_start_marker = '<table className="w-full text-left table-fixed">'
table_end_marker = '</table>'
ts_idx = traz.find(table_start_marker)
te_idx = traz.find(table_end_marker, ts_idx)

new_table = """<table className="w-full text-left table-fixed">
            <thead>
              <tr className="bg-gray-900/80 border-b border-gray-800 text-[9px] font-black tracking-widest text-gray-500 uppercase">
                <th className="px-4 py-4 w-[240px]">CONTACTO</th>
                {templates.slice(0, 3).map((t, idx) => (
                  <th key={t.id} className="px-1 py-4 text-center border-l border-gray-800/50">
                    {idx + 1}° Correo<br/><span className="text-[7px] text-gray-400 capitalize">{t.name.split('. ')[1] || t.name}</span>
                  </th>
                ))}
                <th className="px-2 py-4 text-center border-l border-gray-800/50 w-[110px] text-gray-500">ESTADO SECUENCIA</th>
                <th className="px-2 py-4 text-center border-l border-gray-800/50 w-[110px] text-gray-500">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900">
              {sortedAndFiltered.map((c) => (
                <tr key={c.id} className="group hover:bg-white/5 transition-colors">
                  <td className="px-4 py-5">
                    <div className="flex flex-col gap-1.5">
                      <div className="text-sm font-bold text-white uppercase truncate max-w-[200px]">
                        {c.nombre?.replace('Contacto Principal - ', '') || 'SIN NOMBRE'}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate max-w-[180px] font-medium flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-gray-500" />
                        {c.empresa_rel_name || c.empresa || 'Empresa No Asignada'}
                      </div>
                      <div className={`text-[8px] font-black px-1.5 py-0.5 rounded-sm inline-block w-fit ${
                        c.estado === 'activo' ? 'bg-amber-500/10 text-amber-400 border border-amber-400/20' : 'bg-gray-500/10 text-gray-400 border border-gray-400/20'
                      }`}>
                        {c.estado === 'activo' ? 'CAMPAÑA ACTIVA' : 'CAMPAÑA PAUSADA'}
                      </div>
                    </div>
                  </td>

                  {templates.slice(0, 3).map((t, idx, arr) => (
                    <td key={t.id} className="px-1 py-5 text-center border-l border-gray-900/10">
                      {renderTemplateCell(getTemplateStatus(c, t, arr[idx + 1]))}
                    </td>
                  ))}

                  <td className="px-2 py-5 text-center border-l border-gray-900/10">
                    <div className="flex justify-center items-center">
                      <div className={`text-[9px] font-black px-2 py-1 rounded-md ${
                        c.etapa === 'prospeccion' ? 'bg-amber-500 text-gray-900' : 'bg-blue-500 text-white'
                      }`}>
                        {c.etapa?.toUpperCase() || 'MARKETING'}
                      </div>
                    </div>
                  </td>

                  <td className="px-2 py-5 text-center border-l border-gray-900/10">
                    <div className="flex justify-center items-center gap-2">
                      <button 
                        onClick={() => {
                          const mockCuenta = { cliente: c.empresa_rel_name || c.empresa };
                          abrirModalZoho(c, mockCuenta);
                        }} 
                        className="p-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md hover:scale-110 transition-all flex items-center justify-center border border-gray-750"
                        title="Abrir Zoho / Acciones Sentinel"
                      >
                        <Settings2 className="h-4 w-4 text-indigo-400" />
                      </button>
                      <button 
                        onClick={() => toggleCampanaActiva(c)}
                        className={`p-1 rounded-md transition-all flex items-center justify-center border ${c.estado === 'activo' ? 'bg-green-900/30 hover:bg-green-900/50 text-green-400 border-green-900/50' : 'bg-gray-800 hover:bg-gray-700 text-gray-400 border-gray-750'}`}
                        title={c.estado === 'activo' ? "Pausar Campaña" : "Reactivar Campaña"}
                      >
                        {c.estado === 'activo' ? <Check className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>"""

if ts_idx != -1 and te_idx != -1:
    traz = traz[:ts_idx] + new_table + traz[te_idx + len(table_end_marker):]


with open("client/src/pages/marketing/TrazabilidadBrevo.tsx", "w", encoding="utf-8") as f:
    f.write(traz)

print("Part 2 done.")
