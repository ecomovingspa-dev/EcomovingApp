import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno antes de cualquier import de Supabase
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
console.log("✅ Variables de entorno cargadas con éxito para la API local.");
