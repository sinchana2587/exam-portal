import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = !!process.env.VERCEL;
const BASE_UPLOADS = isVercel
  ? path.join(os.tmpdir(), 'protick_uploads')
  : path.resolve(__dirname, '../../uploads');

const UPLOADS_DIR = path.join(BASE_UPLOADS, 'temp');
const IMAGES_DIR = path.join(BASE_UPLOADS, 'images');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${uniqueSuffix}_${file.originalname}`);
  }
});

const imgStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, IMAGES_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const uniqueSuffix = `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, uniqueSuffix);
  }
});

export const documentUpload = multer({
  storage: docStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

export const imageUpload = multer({
  storage: imgStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (PNG, JPG, JPEG, SVG) are allowed for question/option media.'));
    }
  }
});
