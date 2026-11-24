process.env.PDF2JSON_DISABLE_LOGS = '1';

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/apiRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-role', 'x-user-name', 'x-user-department']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static asset folders
const isVercel = !!process.env.VERCEL;
const uploadsDir = isVercel
  ? path.join(os.tmpdir(), 'protick_uploads')
  : path.resolve(__dirname, '../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/uploads', express.static(uploadsDir));

// Mount API Routes under /api
app.use('/api', apiRoutes);

// Also fallback route handler for /api if rewritten
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  // Check if route matches an API endpoint when accessed without /api prefix
  const isApiRequest = req.path.match(/^\/(health|dashboard|templates|converter|question-paper|student-list|students|history|samples)/);
  if (isApiRequest) {
    return apiRoutes(req, res, next);
  }
  next();
});

// Serve built frontend assets if present locally
const clientDistDir = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(clientDistDir, 'index.html'));
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    statusCode: err.status || 500,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred'
    }
  });
});

export default app;
