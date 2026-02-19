const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const app = express();
const port = process.env.PORT || 5500; // Usa porta do ambiente
const host = process.env.HOST || '0.0.0.0'; // 0.0.0.0 para produção

// Configurações de CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middlewares
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

// Servir arquivos estáticos
app.use(express.static(__dirname, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
}));

// Configuração do Multer para upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 200 * 1024 * 1024, // 200MB
        files: 50000 // Máximo 50.000 arquivos
    }
});

// Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota de upload
app.post('/upload', upload.array('xmls'), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Nenhum arquivo enviado' 
            });
        }

        const arquivos = req.files;
        
        console.log(`✅ Recebidos ${arquivos.length} arquivos para processar`);
        
        const arquivosProcessados = arquivos.map(f => ({
            nome: f.originalname,
            tamanho: f.size,
            conteudo: f.buffer.toString('utf-8')
        }));
        
        res.json({
            success: true,
            arquivos: arquivosProcessados,
            totalArquivos: arquivosProcessados.length
        });
        
    } catch (error) {
        console.error('❌ Erro no upload:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Rota para servir o worker
app.get('/worker.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(path.join(__dirname, 'worker.js'));
});

// Rota de health check
app.get('/ping', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Rota de status
app.get('/status', (req, res) => {
    res.json({
        server: 'Verificador XML NFC-e',
        version: '2.3.0',
        status: 'online',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('❌ Erro no servidor:', err);
    res.status(500).json({ 
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Iniciar servidor
app.listen(port, host, () => {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 VERIFICADOR XML NFC-e v2.3');
    console.log('='.repeat(70));
    console.log(`📡 URL:    http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
    console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log('='.repeat(70));
    console.log('✅ Servidor iniciado com sucesso!');
    console.log('='.repeat(70) + '\n');
});