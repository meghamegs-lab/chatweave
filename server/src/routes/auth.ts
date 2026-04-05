import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { query, queryOne } from '../db';
import { AppError } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';

const router = Router();

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1, 'Display name is required').max(100),
  role: z.enum(['student', 'teacher']).optional().default('student'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BCRYPT_ROUNDS = 12;

/**
 * Set the refresh token as an HttpOnly cookie.
 */
function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/',
  });
}

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

router.post(
  '/register',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          parsed.error.errors.map((e) => e.message).join(', '),
          400,
          'VALIDATION_ERROR',
        );
      }

      const { email, password, displayName, role } = parsed.data;

      // Check email uniqueness
      const existing = await queryOne<{ id: string }>(
        'SELECT id FROM users WHERE email = $1',
        [email],
      );
      if (existing) {
        throw new AppError(
          'An account with this email already exists',
          409,
          'EMAIL_EXISTS',
        );
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // Insert user
      const id = uuidv4();
      await query(
        'INSERT INTO users (id, email, password_hash, display_name, role) VALUES ($1, $2, $3, $4, $5)',
        [id, email, passwordHash, displayName, role],
      );

      // Generate tokens
      const user = { id, email, role };
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // Set refresh token cookie
      setRefreshCookie(res, refreshToken);

      res.status(201).json({
        user: { id, email, displayName, role },
        token: accessToken,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

router.post(
  '/login',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          parsed.error.errors.map((e) => e.message).join(', '),
          400,
          'VALIDATION_ERROR',
        );
      }

      const { email, password } = parsed.data;

      // Find user by email
      const row = await queryOne<{
        id: string;
        email: string;
        password_hash: string;
        display_name: string;
        role: string;
      }>(
        'SELECT id, email, password_hash, display_name, role FROM users WHERE email = $1',
        [email],
      );

      if (!row) {
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // Verify password
      const valid = await bcrypt.compare(password, row.password_hash);
      if (!valid) {
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // Generate tokens
      const user = { id: row.id, email: row.email, role: row.role };
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // Set refresh token cookie
      setRefreshCookie(res, refreshToken);

      res.json({
        user: {
          id: row.id,
          email: row.email,
          displayName: row.display_name,
          role: row.role,
        },
        token: accessToken,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/auth/refresh
// ---------------------------------------------------------------------------

router.post(
  '/refresh',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.refreshToken;
      if (!token) {
        throw new AppError('Refresh token is required', 401, 'MISSING_REFRESH_TOKEN');
      }

      let decoded: { userId: string };
      try {
        decoded = jwt.verify(token, config.jwtRefreshSecret) as {
          userId: string;
        };
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
          throw new AppError(
            'Refresh token has expired',
            401,
            'REFRESH_TOKEN_EXPIRED',
          );
        }
        throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
      }

      // Fetch the user to get current email and role for the new access token
      const row = await queryOne<{ id: string; email: string; role: string }>(
        'SELECT id, email, role FROM users WHERE id = $1',
        [decoded.userId],
      );

      if (!row) {
        throw new AppError('User not found', 401, 'USER_NOT_FOUND');
      }

      const accessToken = generateAccessToken(row);

      res.json({ token: accessToken });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------

router.get(
  '/me',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const row = await queryOne<{
        id: string;
        email: string;
        display_name: string;
        role: string;
      }>(
        'SELECT id, email, display_name, role FROM users WHERE id = $1',
        [req.user!.userId],
      );

      if (!row) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      res.json({
        user: {
          id: row.id,
          email: row.email,
          displayName: row.display_name,
          role: row.role,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
  });
  res.json({ success: true });
});

export default router;
