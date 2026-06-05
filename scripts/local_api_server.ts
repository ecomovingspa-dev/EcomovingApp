import './load_env'; // Cargar variables de entorno PRIMERO para evitar error de importación hoisted de Supabase
import http from 'http';
import enrichAccountsHandler from '../api/enrich-accounts';
import sendTestProspeccionHandler from '../api/send-test-prospeccion';
import sendTestCobranzaHandler from '../api/send-test-cobranza';
import sendTestHandler from '../api/send-test';

// Map of endpoints to handlers
const handlers: Record<string, any> = {
    '/api/enrich-accounts': enrichAccountsHandler,
    '/api/send-test-prospeccion': sendTestProspeccionHandler,
    '/api/send-test-cobranza': sendTestCobranzaHandler,
    '/api/send-test': sendTestHandler,
};

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

    const pathname = req.url?.split('?')[0] || '';
    const handler = handlers[pathname];

    if (handler) {
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
        res.end(JSON.stringify({ error: `Endpoint ${pathname} no encontrado en emulador local` }));
    }
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`🚀 Emulador de API Vercel corriendo localmente en el puerto ${PORT}`);
    console.log("🔗 Endpoints activos:");
    Object.keys(handlers).forEach(path => {
        console.log(`   - http://localhost:${PORT}${path}`);
    });
});

