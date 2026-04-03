import cors from 'cors';
import { config } from '../config';

/**
 * CORS middleware configured from environment.
 * Allows the frontend origin specified in CORS_ORIGIN env var.
 */
export const corsMiddleware = cors({
  origin: [config.corsOrigin, `http://localhost:${config.port}`],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
