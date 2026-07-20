import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || "https://xgdmyjzyejjmwdqkufhp.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || "AIzaSyC7bM_4Fr_Z2DDFMhZPqCTnA7oQLrKBV2I";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Credentials', "true");
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { cuentaId } = req.body;

    try {
        let accountsToProcess = [];

        if (cuentaId) {
            // Procesar una cuenta específica
            const { data, error } = await supabase
                .from('cuentas')
                .select('*')
                .eq('id', cuentaId)
                .single();
            if (error || !data) {
                return res.status(404).json({ error: `No se encontró la cuenta con ID: ${cuentaId}` });
            }
            accountsToProcess = [data];
        } else {
            // Buscar cuentas pendientes ingresadas manualmente que estén activas
            const { data, error } = await supabase
                .from('cuentas')
                .select('*')
                .eq('estado', 'activo')
                .or('origen.eq.manual,origen.is.null')
                .limit(5); // Procesar máximo 5 de una vez para evitar timeout
            
            if (error) throw error;
            accountsToProcess = data || [];
        }

        if (accountsToProcess.length === 0) {
            return res.status(200).json({ success: true, message: "No hay cuentas activas manuales pendientes de enriquecer." });
        }

        const results = [];

        for (const account of accountsToProcess) {
            const companyName = account.cliente;
            console.log(`🤖 Enriqueciendo cuenta: "${companyName}"...`);

            // 1. Llamar a Gemini con Google Search Grounding
            const prompt = `
Encuentra información pública oficial sobre la empresa "${companyName}".
Necesito:
1. Su sitio web oficial (URL completa, ej: www.empresa.cl).
2. Su teléfono central de contacto (o el principal si no está en Chile).
3. Determina si la empresa tiene presencia, representación comercial, oficina local o está operativa de forma directa en Chile (responde true o false).
4. Clasifica la empresa en uno de los siguientes segmentos comerciales según su giro principal (elige estrictamente una opción de esta lista):
   - "Automotoras": Concesionarias, venta de vehículos (autos, camiones, motos), repuestos y talleres.
   - "Salud": Clínicas privadas, centros médicos, centros dentales, laboratorios clínicos.
   - "Comercializadores": Empresas que venden productos físicos, distribuidores, retail, importadoras.
   - "Minería / Industria": Mineras, metalúrgicas, maestranzas, manufactura y fábricas industriales.
   - "Constructoras / Inmobiliarias": Constructoras de obras, desarrollo de proyectos inmobiliarios, arquitectura.
   - "Servicios": Consultoras, empresas de software/TI, empresas de seguridad, aseo, agencias.
   - "Logística / Transporte": Empresas de transporte de carga, navieras, bodegaje, distribución.
   - "Alimentos / Agrícola": Procesadoras de alimentos, packing, viñas, exportadoras agrícolas, cadenas gastronómicas.
5. Correos de contacto y nombres de personas a cargo en las áreas de Adquisiciones, Compras, Sustentabilidad, Finanzas o en su defecto, el correo general de contacto comercial.

Responde estrictamente en formato JSON válido, con la siguiente estructura:
{
  "web": "URL completa del sitio web o null",
  "telefono": "Teléfono formateado en lo posible como +56... o null",
  "presencia_chile": true o false,
  "segmento": "Escribe exactamente una de las 8 categorías del segmento anterior",
  "contactos": [
    {
      "nombre": "Nombre de la persona (deja null si es genérico o no se encuentra)",
      "correo": "correo electrónico corporativo de la persona o del área",
      "cargo": "Cargo o área de desempeño (ej: Compras, Adquisiciones, Sustentabilidad)"
    }
  ]
}
`;

            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
            
            const response = await axios.post(geminiUrl, {
                contents: [
                    {
                        parts: [
                            { text: prompt }
                        ]
                    }
                ],
                tools: [
                    {
                        google_search: {}
                    }
                ],
                generationConfig: {
                    temperature: 0.2
                }
            });

            const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            console.log("Gemini Raw response:", rawText);
            
            let cleaned = rawText.trim();
            if (cleaned.startsWith("```")) {
                cleaned = cleaned.replace(/^```(json)?/i, "");
                cleaned = cleaned.replace(/```$/, "");
            }
            
            const enrichmentData = JSON.parse(cleaned.trim());

            // 2. Normalizar datos
            const web = enrichmentData.web || account.web;
            const telefono = enrichmentData.telefono || account.telefono;
            const sector = 'privado'; // Sourcing de la IA siempre busca sector privado
            
            // Validar presencia en Chile y redefinir estado/segmento
            const tienePresencia = enrichmentData.presencia_chile !== false;
            const estadoActualizado = tienePresencia ? account.estado : 'inactivo';

            const validSegments = [
              'Automotoras',
              'Salud',
              'Comercializadores',
              'Minería / Industria',
              'Constructoras / Inmobiliarias',
              'Servicios',
              'Logística / Transporte',
              'Alimentos / Agrícola'
            ];

            let segmento = 'Servicios';
            if (!tienePresencia) {
              segmento = 'Internacional (Sin filial)';
            } else {
              let aiSegment = enrichmentData.segmento;
              if (aiSegment && validSegments.includes(aiSegment)) {
                segmento = aiSegment;
              } else if (account.segmento && validSegments.includes(account.segmento)) {
                segmento = account.segmento;
              }
            }

            // 3. Actualizar la Cuenta
            const { error: updateError } = await supabase
                .from('cuentas')
                .update({
                    web,
                    sector,
                    segmento,
                    estado: estadoActualizado,
                    origen: 'AI' // Marcar que fue procesada por la IA
                })
                .eq('id', account.id);

            if (updateError) {
                console.error(`Error actualizando cuenta ${companyName}:`, updateError.message);
                results.push({ cuenta: companyName, status: "error_actualizando_cuenta", detail: updateError.message });
                continue;
            }

            const contactosInsertados = [];

            // 4. Procesar e insertar los contactos
            if (enrichmentData.contactos && enrichmentData.contactos.length > 0) {
                for (const contact of enrichmentData.contactos) {
                    if (!contact.correo || !contact.correo.includes('@')) continue;

                    // Validar si el contacto ya existe para evitar duplicación
                    const { data: existingContact } = await supabase
                        .from('contactos')
                        .select('id')
                        .eq('correo', contact.correo.trim().toLowerCase())
                        .maybeSingle();

                    if (existingContact) {
                        console.log(`⚠️ Contacto ${contact.correo} ya existe. Vinculando o ignorando.`);
                        continue;
                    }

                    // Determinar etapa: Si tiene nombre real va a 'marketing', si no (ej: Prospección) va a 'prospeccion'
                    const tieneNombreReal = contact.nombre && contact.nombre.trim() !== "" && !contact.nombre.toLowerCase().includes("contacto") && !contact.nombre.toLowerCase().includes("prospecto");
                    const nombreContacto = tieneNombreReal ? contact.nombre.trim() : "Prospección";

                    const { data: newContact, error: contactError } = await supabase
                        .from('contactos')
                        .insert([
                            {
                                nombre: nombreContacto,
                                correo: contact.correo.trim().toLowerCase(),
                                departamento: contact.cargo || "Adquisiciones",
                                estado: "activo", // REGLA: Activo por defecto para que empiece campaña automáticamente
                                etapa: "prospeccion", // REGLA: Por defecto comienza en prospección (Desactivado en el switch de la UI)
                                cuenta_id: account.id,
                                origen: 'AI', // Marcar origen IA
                                ciudad: account.ciudad || "Santiago",
                                telefono: telefono || null
                            }
                        ])
                        .select('id, correo, etapa')
                        .single();

                    if (contactError) {
                        console.error(`Error insertando contacto ${contact.correo}:`, contactError.message);
                    } else {
                        contactosInsertados.push(newContact);
                    }
                }
            }

            // Si no se encontró ningún contacto con correo, creamos un registro placeholder genérico de Prospección
            if (contactosInsertados.length === 0) {
                // Rastrear un dominio para el correo genérico de la empresa
                const domain = web ? web.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0] : `${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.cl`;
                const generalEmail = `contacto@${domain}`;

                const { data: existingGeneral } = await supabase
                    .from('contactos')
                    .select('id')
                    .eq('correo', generalEmail)
                    .maybeSingle();

                if (!existingGeneral) {
                    const { data: placeholderContact, error: placeholderError } = await supabase
                        .from('contactos')
                        .insert([
                            {
                                nombre: "Prospección",
                                correo: generalEmail,
                                estado: "activo", // REGLA: Activo por defecto para que empiece campaña automáticamente
                                etapa: "prospeccion", // REGLA: Por defecto comienza en prospección (Desactivado en el switch de la UI)
                                cuenta_id: account.id,
                                origen: 'AI',
                                ciudad: account.ciudad || "Santiago",
                                telefono: telefono || null
                            }
                        ])
                        .select('id, correo, etapa')
                        .single();

                    if (!placeholderError) {
                        contactosInsertados.push(placeholderContact);
                    }
                }
            }

            // 5. Clean up any empty/placeholder contacts for this account
            if (contactosInsertados.length > 0) {
                const { error: deleteEmptyError } = await supabase
                    .from('contactos')
                    .delete()
                    .eq('cuenta_id', account.id)
                    .or('correo.is.null,correo.eq.""');
                
                if (deleteEmptyError) {
                    console.error(`Error deleting empty contacts for account ${companyName}:`, deleteEmptyError.message);
                } else {
                    console.log(`Cleaned up empty contacts for account: ${companyName}`);
                }
            }

            // 6. Buscar 5 empresas competidoras/similares en Chile
            console.log(`🤖 Buscando 5 empresas similares a "${companyName}" en Chile...`);
            const similarPrompt = `
Encuentra 5 empresas competidoras directas o muy similares a "${companyName}" que operen en Chile.
El sector es "${sector}" y el segmento es "${segmento}".

Responde estrictamente en formato JSON válido, con la siguiente estructura:
{
  "similares": [
    {
      "cliente": "Nombre oficial de la empresa competidora",
      "web": "URL completa del sitio web oficial de la empresa o null",
      "ciudad": "Ciudad de su casa matriz en Chile o null"
    }
  ]
}
`;
            try {
              const similarResponse = await axios.post(geminiUrl, {
                  contents: [{ parts: [{ text: similarPrompt }] }],
                  tools: [{ google_search: {} }],
                  generationConfig: { temperature: 0.3 }
              });

              const similarText = similarResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
              let similarCleaned = similarText.trim();
              if (similarCleaned.startsWith("```")) {
                  similarCleaned = similarCleaned.replace(/^```(json)?/i, "");
                  similarCleaned = similarCleaned.replace(/```$/, "");
              }
              const similarData = JSON.parse(similarCleaned.trim());
              const empresasSimilares = similarData.similares || [];

              console.log(`Encontradas ${empresasSimilares.length} empresas similares.`);

              for (const emp of empresasSimilares) {
                if (!emp.cliente || emp.cliente.trim() === "") continue;

                // Verificar si ya existe por nombre
                const { data: existingEmp } = await supabase
                  .from("cuentas")
                  .select("id")
                  .ilike("cliente", emp.cliente.trim())
                  .maybeSingle();

                if (existingEmp) {
                  console.log(`La empresa similar "${emp.cliente}" ya existe en la base de datos.`);
                  continue;
                }

                // Insertar nueva cuenta similar como prospecto Sin Verificar
                const { error: insertEmpError } = await supabase
                  .from("cuentas")
                  .insert([
                    {
                      cliente: emp.cliente.trim(),
                      web: emp.web || null,
                      ciudad: emp.ciudad || "Santiago",
                      sector: sector,
                      segmento: segmento,
                      estado: "prospecto",
                      etapa_prospeccion: "Sin Verificar",
                      origen: "AI"
                    }
                  ]);

                if (insertEmpError) {
                  console.error(`Error al insertar empresa similar "${emp.cliente}":`, insertEmpError.message);
                } else {
                  console.log(`Insertada empresa similar: "${emp.cliente}"`);
                }
              }
            } catch (simErr: any) {
              console.error(`Error al buscar/guardar empresas similares para ${companyName}:`, simErr.message || simErr);
            }

            results.push({
                cuenta: companyName,
                status: "enriquecida",
                web,
                telefono,
                sector,
                segmento,
                contactosEncontrados: contactosInsertados
            });
        }

        return res.status(200).json({
            success: true,
            results
        });

    } catch (err: any) {
        console.error("Error en enrich-accounts:", err);
        const errMsg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
        return res.status(500).json({ error: errMsg });
    }
}
