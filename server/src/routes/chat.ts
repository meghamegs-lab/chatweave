import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db';
import { AppError } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const createSessionSchema = z.object({
  title: z.string().min(1).max(500).optional(),
});

const updateSessionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
});

const createMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string().min(1, 'Content is required'),
  metadata: z.union([z.record(z.unknown()), z.string()]).optional(),
});

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionRow {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  metadata: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract :id param as string (Express 5 types params as string | string[]). */
function getIdParam(req: Request): string {
  return req.params.id as string;
}

function formatSession(row: SessionRow) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatMessage(row: MessageRow) {
  let parsedMetadata: unknown = null;
  if (row.metadata) {
    try {
      parsedMetadata = JSON.parse(row.metadata);
    } catch {
      parsedMetadata = row.metadata;
    }
  }

  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    metadata: parsedMetadata,
    createdAt: row.created_at,
  };
}

/**
 * Fetch a session and verify the authenticated user owns it.
 * Throws 404 if not found, 403 if not owned by the user.
 */
function getOwnedSession(sessionId: string, userId: string): SessionRow {
  const db = getDatabase();
  const session = db
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .get(sessionId) as SessionRow | undefined;

  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  if (session.user_id !== userId) {
    throw new AppError('You do not have access to this session', 403, 'FORBIDDEN');
  }

  return session;
}

// ---------------------------------------------------------------------------
// All routes require authentication
// ---------------------------------------------------------------------------

router.use(authMiddleware);

// ---------------------------------------------------------------------------
// POST /api/chat/sessions
// ---------------------------------------------------------------------------

router.post(
  '/sessions',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          parsed.error.errors.map((e) => e.message).join(', '),
          400,
          'VALIDATION_ERROR',
        );
      }

      const { title } = parsed.data;
      const db = getDatabase();
      const id = uuidv4();
      const now = new Date().toISOString();

      db.prepare(
        'INSERT INTO sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      ).run(id, req.user!.userId, title ?? 'New Chat', now, now);

      const session = db
        .prepare('SELECT * FROM sessions WHERE id = ?')
        .get(id) as SessionRow;

      res.status(201).json({ session: formatSession(session) });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/chat/sessions
// ---------------------------------------------------------------------------

router.get(
  '/sessions',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = getDatabase();
      const rows = db
        .prepare(
          'SELECT * FROM sessions WHERE user_id = ? ORDER BY updated_at DESC',
        )
        .all(req.user!.userId) as SessionRow[];

      res.json({ sessions: rows.map(formatSession) });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/chat/sessions/:id
// ---------------------------------------------------------------------------

router.get(
  '/sessions/:id',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = getIdParam(req);
      const session = getOwnedSession(sessionId, req.user!.userId);

      const db = getDatabase();
      const messages = db
        .prepare(
          'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC',
        )
        .all(sessionId) as MessageRow[];

      res.json({
        session: formatSession(session),
        messages: messages.map(formatMessage),
      });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/chat/sessions/:id
// ---------------------------------------------------------------------------

router.patch(
  '/sessions/:id',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = getIdParam(req);
      getOwnedSession(sessionId, req.user!.userId);

      const parsed = updateSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          parsed.error.errors.map((e) => e.message).join(', '),
          400,
          'VALIDATION_ERROR',
        );
      }

      const { title } = parsed.data;
      const db = getDatabase();
      const now = new Date().toISOString();

      db.prepare(
        'UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?',
      ).run(title, now, sessionId);

      const updated = db
        .prepare('SELECT * FROM sessions WHERE id = ?')
        .get(sessionId) as SessionRow;

      res.json({ session: formatSession(updated) });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/chat/sessions/:id
// ---------------------------------------------------------------------------

router.delete(
  '/sessions/:id',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = getIdParam(req);
      getOwnedSession(sessionId, req.user!.userId);

      const db = getDatabase();
      // Messages are deleted automatically via ON DELETE CASCADE
      db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/chat/sessions/:id/messages
// ---------------------------------------------------------------------------

router.post(
  '/sessions/:id/messages',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = getIdParam(req);
      getOwnedSession(sessionId, req.user!.userId);

      const parsed = createMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          parsed.error.errors.map((e) => e.message).join(', '),
          400,
          'VALIDATION_ERROR',
        );
      }

      const { role, content, metadata } = parsed.data;
      const db = getDatabase();
      const id = uuidv4();
      const now = new Date().toISOString();

      // Serialize metadata to JSON string if it's an object
      let metadataStr: string | null = null;
      if (metadata !== undefined && metadata !== null) {
        metadataStr =
          typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
      }

      db.prepare(
        'INSERT INTO messages (id, session_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(id, sessionId, role, content, metadataStr, now);

      // Update session's updated_at timestamp
      db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(
        now,
        sessionId,
      );

      const message = db
        .prepare('SELECT * FROM messages WHERE id = ?')
        .get(id) as MessageRow;

      res.status(201).json({ message: formatMessage(message) });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/chat/sessions/:id/messages
// ---------------------------------------------------------------------------

router.get(
  '/sessions/:id/messages',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = getIdParam(req);
      getOwnedSession(sessionId, req.user!.userId);

      const parsed = paginationSchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError(
          parsed.error.errors.map((e) => e.message).join(', '),
          400,
          'VALIDATION_ERROR',
        );
      }

      const { limit, offset } = parsed.data;
      const db = getDatabase();

      const countRow = db
        .prepare('SELECT COUNT(*) as total FROM messages WHERE session_id = ?')
        .get(sessionId) as { total: number };

      const messages = db
        .prepare(
          'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?',
        )
        .all(sessionId, limit, offset) as MessageRow[];

      res.json({
        messages: messages.map(formatMessage),
        total: countRow.total,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
