import cors from 'cors';
import { config } from '../config';

/**
 * CORS middleware configured from environment.
 * Allows the frontend origin specified in CORS_ORIGIN env var.
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests from: configured origin, localhost, same-origin (no origin header), or Railway URLs
    const allowed = [config.corsOrigin, `http://localhost:${config.port}`];
    if (!origin || allowed.includes(origin) || origin.endsWith('.up.railway.app')) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
