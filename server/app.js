const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/TESTE'; // <- configurable
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(helmet());
app.use(express.json());

// API key middleware (igual que tenías)
const API_KEY = process.env.API_KEY;
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  const key = req.headers['x-api-key'];
  if (!key || key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

// seguridad: reemplazar espacios y evitar path traversal
function safeFilename(filename) {
  return path.basename(filename).replace(/\s+/g, '_');
}

// Multer storage configurado para guardar en UPLOAD_DIR
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ts = Date.now();
    cb(null, `${ts}-${safeFilename(file.originalname)}`);
  }
});

// fileFilter: aceptar solo .txt.gz (opcional)
function fileFilter(req, file, cb) {
  const allowed = /\.txt\.gz$/i;
  if (!allowed.test(file.originalname)) {
    return cb(new Error('Sólo se permiten archivos .txt.gz'), false);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 200 * 1024 * 1024 } // ajustar tamaño si hace falta
});

// endpoint que recibe múltiples archivos en un solo request
app.post('/upload-multiple', upload.array('files', 50), (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files' });

  // devolver lista de nombres guardados
  const files = req.files.map(f => ({
    originalname: f.originalname,
    savedAs: f.filename,
    path: f.path,
    size: f.size
  }));
  res.json({ ok: true, files });
});

// health
app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Upload server running on ${PORT}, upload dir: ${UPLOAD_DIR}`));
