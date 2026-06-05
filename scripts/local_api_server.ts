import './load_env'; // Cargar variables de entorno PRIMERO para evitar error de importación hoisted de Supabase
import http from 'http';
import handler from '../api/enrich-accounts';

// Emulador local super liviano de Vercel Serverless Functions
const server = http.createServer(async (req: any, res: any) => {
    // Configurar cabeceras CORS básicas
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.end();
        return;
    }

    if (req.url === '/api/enrich-accounts') {
        let body = '';
        req.on('data', (chunk: any) => {
            body += chunk;
        });
        req.on('end', async () => {
            try {
                req.body = body ? JSON.parse(body) : {};
            } catch (e) {
                req.body = {};
            }

            // Emular métodos auxiliares de Vercel Response
            res.status = (code: number) => {
                res.statusCode = code;
                return res;
            };
            res.json = (data: any) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
            };

            try {
                await handler(req, res);
            } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Endpoint no encontrado en emulador local' }));
    }
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`🚀 Emulador de API Vercel corriendo localmente en el puerto ${PORT}`);
    console.log(`🔗 Endpoint activo: http://localhost:${PORT}/api/enrich-accounts`);
});
