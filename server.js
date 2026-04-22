const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOAD_DIR = path.join(__dirname, 'photo');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const uniq = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniq + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Invalid file type'), false);
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(require('cors')());
app.use(helmet());
app.use(express.static(path.join(__dirname)));

// rate limit API endpoints
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
app.use('/api/', apiLimiter);

const GALLERY_FILE = path.join(__dirname, 'gallery.json');
const DATA_KEY = process.env.DATA_KEY || '';
function deriveKey() { return crypto.createHash('sha256').update(String(DATA_KEY)).digest(); }

function readGallery() {
  try {
    if (!fs.existsSync(GALLERY_FILE)) return [];
    const raw = fs.readFileSync(GALLERY_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.data && parsed.iv && parsed.tag && DATA_KEY) {
      const key = deriveKey();
      const iv = Buffer.from(parsed.iv, 'hex');
      const tag = Buffer.from(parsed.tag, 'hex');
      const encrypted = Buffer.from(parsed.data, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const dec = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return JSON.parse(dec.toString('utf8'));
    }
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch (e) { return []; }
}

function saveGallery(arr) {
  if (DATA_KEY) {
    const key = deriveKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(arr), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const out = { iv: iv.toString('hex'), tag: tag.toString('hex'), data: encrypted.toString('hex') };
    fs.writeFileSync(GALLERY_FILE, JSON.stringify(out, null, 2));
  } else {
    fs.writeFileSync(GALLERY_FILE, JSON.stringify(arr, null, 2));
  }
}

if (!DATA_KEY) {
  console.warn('WARNING: DATA_KEY not set. gallery.json will be stored unencrypted. Set DATA_KEY in environment to enable encryption.');
}

// simple API key check for upload endpoint
function checkApiKey(req, res, next) {
  const apiKey = req.get('x-api-key') || req.query.apiKey || req.headers['authorization'];
  if (!process.env.ADMIN_API_KEY) return res.status(403).json({ error: 'server not configured with ADMIN_API_KEY' });
  if (!apiKey || String(apiKey) !== String(process.env.ADMIN_API_KEY)) return res.status(401).json({ error: 'invalid api key' });
  next();
}

app.post('/api/upload', checkApiKey, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const { title, description, date, tags } = req.body;
  let tagsArr = [];
  try { tagsArr = tags ? JSON.parse(tags) : (tags ? tags.split(',').map(s => s.trim()).filter(Boolean) : []); }
  catch (e) { tagsArr = tags ? tags.split(',').map(s => s.trim()).filter(Boolean) : []; }
  const item = { id: Date.now(), src: 'photo/' + req.file.filename, title, description, date, tags: tagsArr };
  const gallery = readGallery();
  gallery.push(item);
  saveGallery(gallery);
  res.json({ ok: true, item });
});

app.get('/api/gallery', (req, res) => {
  const gallery = readGallery();
  res.json(gallery);
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
