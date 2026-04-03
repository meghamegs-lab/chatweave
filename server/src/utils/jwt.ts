import jwt from 'jsonwebtoken';
import { config } from '../config';

/**
 * Generate a short-lived access token (1 hour).
 */
export function generateAccessToken(user: {
  id: string;
  email: string;
  role: string;
}): string {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '1h' },
  );
}

/**
 * Generate a long-lived refresh token (7 days).
 */
export function generateRefreshToken(user: { id: string }): string {
  return jwt.sign({ userId: user.id }, config.jwtRefreshSecret, {
    expiresIn: '7d',
  });
}
