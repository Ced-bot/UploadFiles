const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const sequelize = require('./db');

// Check bd conection
(async () => {
  try {
    await sequelize.authenticate();
    console.log('DB connected');
  } catch (err) {
    console.error('DB connection error', err);
    process.exit(1);
  }
})();


const UPLOAD_DIR = process.env.UPLOAD_DIR || '/files'; // <- configurable
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
  destination: (req, file, cb) => {
    let subdir;

    // lógica según el nombre del archivo
    if (file.originalname.toLowerCase().includes('amostra')) {
      subdir = 'amostras';
    } else if (file.originalname.toLowerCase().includes('video')) {
      subdir = 'seg_videos';
    } else {
      subdir = ''; // carpeta raíz si no coincide
    }

    const targetDir = path.join(UPLOAD_DIR, subdir);
    fs.mkdirSync(targetDir, { recursive: true }); // asegurar que exista
    cb(null, targetDir);
  },
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


// POST /data
// Body: { key: "algo", payload: {...}, notes: "opcional" }
app.post('/data', async (req, res) => {
  try {
    const { table, ...fields } = req.body;

    if (!table) return res.status(400).json({ error: 'table required' });
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: 'no fields to insert' });
    }

    // columnas y valores dinámicos
    const columns = Object.keys(fields);
    const values = Object.values(fields).map(v =>
      typeof v === 'object' ? JSON.stringify(v) : v
    );

    // placeholders ?, ?, ? según cantidad de columnas
    const placeholders = columns.map(() => '?').join(', ');

    const query = `INSERT INTO \`${table}\` (${columns.join(', ')}) VALUES (${placeholders})`;

    const [result] = await sequelize.query(query, { replacements: values });

    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

// health
app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Upload server running on ${PORT}, upload dir: ${UPLOAD_DIR}`));
