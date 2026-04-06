import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, queryAll } from '../db';
import { pluginRegistry } from '../services/pluginRegistry';
import { AppError } from '../middleware/errorHandler';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

// All moderation routes require authentication
router.use(authMiddleware);

// ─── Plugin Rules ───────────────────────────────────────────────────────────

/** GET /api/moderation/rules — List all plugin rules */
router.get('/rules', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await queryAll('SELECT * FROM plugin_rules ORDER BY severity DESC, title ASC');
    res.json({ rules });
  } catch (err) {
    next(err);
  }
});

// ─── Plugin Violations ──────────────────────────────────────────────────────

/** GET /api/moderation/violations — List all violations (optionally filter by plugin_id) */
router.get('/violations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pluginId = req.query.plugin_id as string | undefined;

    let violations;
    if (pluginId) {
      violations = await queryAll(`
        SELECT v.*, p.name as plugin_name, r.title as rule_title
        FROM plugin_violations v
        LEFT JOIN plugins p ON v.plugin_id = p.id
        LEFT JOIN plugin_rules r ON v.rule_id = r.id
        WHERE v.plugin_id = $1
        ORDER BY v.created_at DESC
      `, [pluginId]);
    } else {
      violations = await queryAll(`
        SELECT v.*, p.name as plugin_name, r.title as rule_title
        FROM plugin_violations v
        LEFT JOIN plugins p ON v.plugin_id = p.id
        LEFT JOIN plugin_rules r ON v.rule_id = r.id
        ORDER BY v.created_at DESC
      `);
    }

    res.json({ violations });
  } catch (err) {
    next(err);
  }
});

/** POST /api/moderation/violations — Report a violation against a plugin */
router.post('/violations', requireRole('teacher', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { plugin_id, rule_id, reason, action } = req.body;

    if (!plugin_id || !reason) {
      throw new AppError('plugin_id and reason are required', 400, 'INVALID_REQUEST');
    }

    const plugin = pluginRegistry.getById(plugin_id);
    if (!plugin) {
      throw new AppError(`Plugin "${plugin_id}" not found`, 404, 'PLUGIN_NOT_FOUND');
    }

    const actionTaken = action || 'flagged';
    const id = uuidv4().replace(/-/g, '').slice(0, 32);

    await query(`
      INSERT INTO plugin_violations (id, plugin_id, rule_id, reason, action_taken)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, plugin_id, rule_id || null, reason, actionTaken]);

    // If action is 'disabled', disable the plugin immediately
    if (actionTaken === 'disabled') {
      await pluginRegistry.disable(plugin_id);
    }

    // If action is 'removed', remove the plugin immediately
    if (actionTaken === 'removed') {
      await pluginRegistry.remove(plugin_id);
    }

    res.status(201).json({
      violation: { id, plugin_id, rule_id, reason, action_taken: actionTaken },
    });
  } catch (err) {
    next(err);
  }
});

// ─── Immediate Removal ─────────────────────────────────────────────────────

/** POST /api/moderation/plugins/:id/remove — Immediately remove a plugin for rule violation */
router.post('/plugins/:id/remove', requireRole('teacher', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pluginId = req.params.id as string;
    const { reason, rule_id } = req.body;

    const plugin = pluginRegistry.getById(pluginId);
    if (!plugin) {
      throw new AppError(`Plugin "${pluginId}" not found`, 404, 'PLUGIN_NOT_FOUND');
    }

    // Log the violation
    const violationId = uuidv4().replace(/-/g, '').slice(0, 32);
    await query(`
      INSERT INTO plugin_violations (id, plugin_id, rule_id, reason, action_taken)
      VALUES ($1, $2, $3, $4, 'removed')
    `, [violationId, pluginId, rule_id || null, reason || 'Removed by administrator']);

    // Remove the plugin
    pluginRegistry.remove(pluginId);

    res.json({ message: `Plugin "${pluginId}" has been removed`, violation_id: violationId });
  } catch (err) {
    next(err);
  }
});

// ─── Plugin Submissions (Registry) ─────────────────────────────────────────

/** GET /api/moderation/submissions — List all plugin submissions */
router.get('/submissions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;

    let submissions;
    if (status) {
      submissions = await queryAll('SELECT * FROM plugin_submissions WHERE status = $1 ORDER BY created_at DESC', [status]);
    } else {
      submissions = await queryAll('SELECT * FROM plugin_submissions ORDER BY created_at DESC');
    }

    // Parse manifest JSON for each submission
    const parsed = (submissions as any[]).map(s => ({
      ...s,
      manifest: JSON.parse(s.manifest),
    }));

    res.json({ submissions: parsed });
  } catch (err) {
    next(err);
  }
});

/** POST /api/moderation/submissions — Submit a plugin for review */
router.post('/submissions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { manifest } = req.body;

    if (!manifest || !manifest.id || !manifest.name) {
      throw new AppError('A valid plugin manifest is required', 400, 'INVALID_MANIFEST');
    }

    // Check if plugin ID already exists
    const existing = pluginRegistry.getById(manifest.id);
    if (existing) {
      throw new AppError(`Plugin with id "${manifest.id}" is already registered`, 409, 'PLUGIN_EXISTS');
    }

    const id = uuidv4().replace(/-/g, '').slice(0, 32);

    await query(`
      INSERT INTO plugin_submissions (id, manifest, status)
      VALUES ($1, $2, 'pending')
    `, [id, JSON.stringify(manifest)]);

    res.status(201).json({ submission: { id, status: 'pending', manifest } });
  } catch (err) {
    next(err);
  }
});

/** POST /api/moderation/submissions/:id/approve — Approve a submission and register the plugin */
router.post('/submissions/:id/approve', requireRole('teacher', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const submissionId = req.params.id as string;

    const submission = await queryOne<any>('SELECT * FROM plugin_submissions WHERE id = $1', [submissionId]);
    if (!submission) {
      throw new AppError('Submission not found', 404, 'NOT_FOUND');
    }

    if (submission.status !== 'pending') {
      throw new AppError(`Submission already ${submission.status}`, 400, 'ALREADY_PROCESSED');
    }

    const manifest = JSON.parse(submission.manifest);

    // Register the plugin
    const plugin = await pluginRegistry.register(manifest);

    // Update submission status
    await query(`
      UPDATE plugin_submissions SET status = 'approved', review_notes = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [req.body.notes || null, submissionId]);

    res.json({ plugin, submission_id: submissionId });
  } catch (err) {
    next(err);
  }
});

/** POST /api/moderation/submissions/:id/reject — Reject a submission */
router.post('/submissions/:id/reject', requireRole('teacher', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const submissionId = req.params.id as string;

    const submission = await queryOne<any>('SELECT * FROM plugin_submissions WHERE id = $1', [submissionId]);
    if (!submission) {
      throw new AppError('Submission not found', 404, 'NOT_FOUND');
    }

    if (submission.status !== 'pending') {
      throw new AppError(`Submission already ${submission.status}`, 400, 'ALREADY_PROCESSED');
    }

    await query(`
      UPDATE plugin_submissions SET status = 'rejected', review_notes = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [req.body.reason || 'Does not meet platform guidelines', submissionId]);

    res.json({ message: 'Submission rejected', submission_id: submissionId });
  } catch (err) {
    next(err);
  }
});

export { router as moderationRouter };
