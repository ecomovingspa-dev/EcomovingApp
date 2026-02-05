import React, { useState } from 'react';
import { Linkedin, Sparkles, Loader2, X, Plus, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { prospectLinkedIn } from '../lib/gemini';

interface LinkedInContact {
    name: string;
    role: string;
    email: string;
}

interface ProspectorIAModalProps {
    isOpen: boolean;
    onClose: () => void;
    accountName: string;
    accountId: string;
}

export const ProspectorIAModal: React.FC<ProspectorIAModalProps> = ({ isOpen, onClose, accountName, accountId }) => {
    const [loading, setLoading] = useState(false);
    const [contacts, setContacts] = useState<LinkedInContact[]>([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

    if (!isOpen) return null;

    const startSearch = async () => {
        setSearching(true);
        setLoading(true);
        setError(null);

        try {
            console.log(`[PROSPECTOR] Buscando contactos para ${accountName}...`);
            const results = await prospectLinkedIn(accountName);
            setContacts(results);
        } catch (err: any) {
            console.error("Error en prospector:", err);
            setError("No pudimos conectar con la base de datos de LinkedIn. Intenta nuevamente.");
        } finally {
            setLoading(false);
        }
    };

    const addContact = async (contact: LinkedInContact) => {
        try {
            const { error } = await supabase.from('contactos').insert([
                {
                    nombre: contact.name,
                    correo: contact.email,
                    cuenta_id: accountId,
                    estado: 'activo'
                }
            ]);

            if (error) throw error;
            setAddedIds((prev: Set<string>) => new Set(prev).add(contact.email));
        } catch (err) {
            console.error("Error al agregar contacto:", err);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-blue-600 to-indigo-600">
                    <div className="flex items-center gap-3 text-white">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Sparkles className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Prospector IA: {accountName}</h2>
                            <p className="text-blue-100 text-sm">Búsqueda inteligente de contactos en LinkedIn</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors p-2">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="p-8">
                    {!searching ? (
                        <div className="text-center space-y-6 py-8">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                <Linkedin className="h-10 w-10" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">¿Buscas contactos en {accountName}?</h3>
                                <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-2">
                                    La IA buscará perfiles clave en LinkedIn y generará sus correos corporativos probables.
                                </p>
                            </div>
                            <button
                                onClick={startSearch}
                                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/25 flex items-center gap-2 mx-auto"
                            >
                                <Sparkles className="h-5 w-5" />
                                Iniciar Búsqueda
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                    <div className="relative">
                                        <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
                                        <Sparkles className="absolute -top-2 -right-2 h-6 w-6 text-yellow-400 animate-pulse" />
                                    </div>
                                    <p className="text-gray-600 dark:text-gray-400 font-medium">Analizando LinkedIn para {accountName}...</p>
                                </div>
                            ) : error ? (
                                <div className="text-center py-12 space-y-4">
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 text-red-500">
                                        <AlertCircle className="h-8 w-8" />
                                    </div>
                                    <p className="text-red-600 font-medium">{error}</p>
                                    <button onClick={startSearch} className="text-blue-600 font-bold hover:underline">Reintentar</button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Contactos Encontrados</h4>
                                    <div className="grid gap-3">
                                        {contacts.map((contact: LinkedInContact, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700 group hover:border-blue-200 dark:hover:border-blue-900/50 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                                                        {contact.name[0]}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-gray-900 dark:text-white">{contact.name}</div>
                                                        <div className="text-sm text-gray-500 dark:text-gray-400">{contact.role}</div>
                                                        <div className="text-xs font-mono text-blue-500 mt-1">{contact.email}</div>
                                                    </div>
                                                </div>
                                                {addedIds.has(contact.email) ? (
                                                    <div className="flex items-center gap-1 text-green-600 font-bold text-sm px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                                        <Check className="h-4 w-4" /> Agregado
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => addContact(contact)}
                                                        className="p-3 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl border border-blue-200 dark:border-blue-900/50 transition-all flex items-center gap-2 group/btn"
                                                    >
                                                        <Plus className="h-5 w-5 group-hover/btn:scale-110 transition-transform" />
                                                        <span className="text-sm font-bold">Importar</span>
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="pt-4 flex justify-between items-center text-xs text-gray-500">
                                        <span>* Los correos son generados por IA a partir del patrón de la empresa.</span>
                                        <button onClick={() => setSearching(false)} className="text-blue-600 hover:underline">Nueva búsqueda</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
