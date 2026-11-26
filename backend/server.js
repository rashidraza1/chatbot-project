require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

const { sequelize } = require('./models');
const chatHandler = require('./sockets/chatHandler');

// Ensure persistent uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Next.js Unified Integration (Architecture B: Single Combined Node App)
const candidateFrontendDirs = [
  path.join(__dirname, 'frontend'),
  path.join(__dirname, '..', 'frontend')
];
const frontendDir = candidateFrontendDirs.find(d => fs.existsSync(path.join(d, '.next'))) || path.join(__dirname, 'frontend');

let nextApp = null;
let nextHandle = null;
let nextReady = false;
let nextPromise = null;

if (process.env.SERVE_FRONTEND === 'true' || fs.existsSync(path.join(frontendDir, '.next'))) {
  try {
    let next;
    try {
      next = require('next');
    } catch (e) {
      next = require(path.join(frontendDir, 'node_modules', 'next'));
    }
    nextApp = next({ dev: false, dir: frontendDir });
    nextHandle = nextApp.getRequestHandler();
    nextPromise = nextApp.prepare().then(() => {
      nextReady = true;
      console.log('Next.js frontend prepared successfully for:', frontendDir);
    }).catch(err => {
      console.error('Failed to prepare Next.js frontend:', err);
    });
  } catch (err) {
    console.log('Next.js integration skipped (standalone backend mode):', err.message);
  }
}

const app = express();
const server = http.createServer(app);

// Trust proxy for LiteSpeed reverse proxy
app.set('trust proxy', 1);

// Serve static widget files
app.use(express.static(path.join(__dirname, 'public')));

// Security and Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: false,
  frameguard: false
}));

// Allow chatbot widget to be embedded in iframes on any third-party website, local file, or webview
app.use((req, res, next) => {
  if (req.path.startsWith('/widget')) {
    res.removeHeader('X-Frame-Options');
    res.removeHeader('x-frame-options');
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('content-security-policy');
  }
  next();
});

// CORS Configuration
const allowedAdminOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000'
].filter(Boolean);

const adminCors = cors({
  origin: (origin, callback) => {
    // Allow same-origin, curl, server-to-server or explicit frontend origins
    if (!origin || allowedAdminOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
});

const publicCors = cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

app.use(express.json());

// Rate limiting on API routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000
});
app.use('/api', limiter);

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  chatHandler(io, socket);
});

// Route Socket.io HTTP requests through Express for Phusion Passenger compatibility
app.use((req, res, next) => {
  if (req.originalUrl && req.originalUrl.startsWith('/socket.io')) {
    return io.engine.handleRequest(req, res);
  }
  next();
});

// API Routes
app.get('/health', (req, res) => res.status(200).json({ status: 'OK' }));

// Protected Management API Routes
app.use('/api/auth', adminCors, require('./routes/authRoutes'));
app.use('/api/bots', (req, res, next) => {
  if (req.path.endsWith('/widget')) {
    return publicCors(req, res, next);
  }
  return adminCors(req, res, next);
}, require('./routes/botRoutes'));
app.use('/api/conversations', adminCors, require('./routes/conversationRoutes'));
app.use('/api/chat', publicCors, require('./routes/chatRoutes'));
app.use('/api/pdfs', adminCors, require('./routes/pdfRoutes'));
app.use('/api/admin', adminCors, require('./routes/adminGuideRoutes'));

// Public Widget and Guide Routes
app.use('/api/chatbot', publicCors, require('./routes/chatbotGuideRoutes'));

// Delegate all other routes to Next.js (if integrated)
if (nextHandle) {
  app.use(async (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
      return next();
    }
    try {
      if (!nextReady && nextPromise) {
        await nextPromise;
      }
      return nextHandle(req, res);
    } catch (err) {
      console.error('Error handling Next.js request:', err);
      return next(err);
    }
  });
}

// Database Sync and Server Startup
const PORT = process.env.PORT || 10000;

const startServer = () => {
  sequelize.sync().then(async () => {
    console.log('Database connected and synced');
    try {
      const [cols] = await sequelize.query("SHOW COLUMNS FROM visitors LIKE 'phone'");
      if (cols.length === 0) {
        await sequelize.query("ALTER TABLE visitors ADD COLUMN phone VARCHAR(255) NULL AFTER email");
        console.log('Added missing phone column to visitors table');
      }
    } catch (e) {
      console.log('Notice checking phone column:', e.message);
    }
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  }).catch(err => {
    console.error('Unable to connect to the database:', err);
  });
};

if (nextPromise) {
  nextPromise.then(startServer);
} else {
  startServer();
}

module.exports = app;
