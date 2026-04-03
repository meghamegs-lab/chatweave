import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config';
import { initializeDatabase, closeDatabase } from './db';
import { corsMiddleware } from './middleware/cors';
import { errorHandler } from './middleware/errorHandler';
import authRouter from './routes/auth';
import chatRouter from './routes/chat';
import { pluginRouter } from './routes/plugins';
import { proxyRouter } from './routes/proxy';
import { oauthRouter } from './routes/oauth';
import { pluginRegistry } from './services/pluginRegistry';
import { initializeSocketService } from './services/socketService';
import { pluginManifestSchema, PluginManifest } from './types/plugin';

// Create Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Attach Socket.io with CORS configured for the frontend origin
const io = new SocketIOServer(server, {
  cors: {
    origin: [config.corsOrigin, `http://localhost:${config.port}`],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// --- Middleware ---
app.use(corsMiddleware);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Routes ---

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Auth routes
app.use('/api/auth', authRouter);

// Chat routes
app.use('/api/chat', chatRouter);

// Plugin routes
app.use('/api/plugins', pluginRouter);

// Proxy routes (weather API key hiding)
app.use('/api/proxy', proxyRouter);

// OAuth routes (plugin auth flows)
app.use('/api/oauth', oauthRouter);

// --- Serve web chat UI ---
app.use(express.static(path.resolve(__dirname, '..', 'public')));

// --- Serve plugin static builds ---
// Each plugin's built dist/ folder is served at /plugins/:pluginDirName/
const pluginsDir = path.resolve(__dirname, '..', '..', 'plugins');
if (fs.existsSync(pluginsDir)) {
  const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'sdk') continue;
    const distDir = path.join(pluginsDir, entry.name, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(`/plugins/${entry.name}`, express.static(distDir));
      console.log(`[Server] Serving plugin: /plugins/${entry.name}/ → ${distDir}`);
    }
  }
}

// --- Error handling (must be last) ---
app.use(errorHandler);

// --- Socket.io connection handler ---
initializeSocketService(io);

// --- Initialize database and start server ---
/**
 * Discover and load bundled plugin manifests from the plugins directory.
 * Reads each subdirectory for a manifest.json file.
 */
function loadBundledPlugins(): PluginManifest[] {
  const pluginsDir = path.resolve(__dirname, '..', '..', 'plugins');
  const manifests: PluginManifest[] = [];

  if (!fs.existsSync(pluginsDir)) {
    console.log('[Server] No plugins directory found, skipping bundled plugin loading');
    return manifests;
  }

  const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const manifestPath = path.join(pluginsDir, entry.name, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;

    try {
      const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      // Rewrite iframe_url to serve from this server instead of separate ports
      raw.iframe_url = `http://localhost:${config.port}/plugins/${entry.name}/`;
      const parsed = pluginManifestSchema.parse(raw);
      manifests.push(parsed);
    } catch (err) {
      console.error(`[Server] Failed to load manifest from ${manifestPath}:`, err);
    }
  }

  return manifests;
}

function startup(): void {
  try {
    // Initialize SQLite database (creates tables on first run)
    initializeDatabase();

    // Load plugin registry from database, then register bundled plugins
    pluginRegistry.loadFromDatabase();
    const bundledManifests = loadBundledPlugins();
    if (bundledManifests.length > 0) {
      pluginRegistry.registerBundled(bundledManifests);
    }

    // Start listening
    server.listen(config.port, () => {
      console.log(`[Server] ChatBridge backend running on port ${config.port}`);
      console.log(`[Server] Environment: ${config.nodeEnv}`);
      console.log(`[Server] CORS origin: ${config.corsOrigin}`);
      console.log(`[Server] Health check: http://localhost:${config.port}/api/health`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

// --- Graceful shutdown ---
function shutdown(signal: string): void {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);

  server.close(() => {
    console.log('[Server] HTTP server closed');
    closeDatabase();
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the server
startup();

export { app, server, io };
