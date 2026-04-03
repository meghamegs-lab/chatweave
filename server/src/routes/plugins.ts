import { Router, Request, Response, NextFunction } from 'express';
import { pluginRegistry } from '../services/pluginRegistry';

const router = Router();

/** Extract :id param as string (Express 5 types params as string | string[]). */
function getIdParam(req: Request): string {
  return req.params.id as string;
}

/**
 * GET /api/plugins
 * List all registered plugins.
 */
router.get('/', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const plugins = pluginRegistry.getAll();
    res.json({ plugins });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/plugins/:id
 * Get a single plugin by ID, including its tools.
 */
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getIdParam(req);
    const plugin = pluginRegistry.getById(id);
    if (!plugin) {
      res.status(404).json({
        error: { message: `Plugin "${id}" not found`, code: 'PLUGIN_NOT_FOUND' },
      });
      return;
    }
    res.json({ plugin });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/plugins/register
 * Register a new plugin by providing its manifest.
 */
router.post('/register', (req: Request, res: Response, next: NextFunction) => {
  try {
    const plugin = pluginRegistry.register(req.body);
    res.status(201).json({ plugin });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/plugins/:id
 * Update an existing plugin's manifest.
 */
router.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getIdParam(req);
    const plugin = pluginRegistry.update(id, req.body);
    res.json({ plugin });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/plugins/:id
 * Remove a plugin.
 */
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getIdParam(req);
    pluginRegistry.remove(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/plugins/:id/enable
 * Enable a plugin.
 */
router.post('/:id/enable', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getIdParam(req);
    pluginRegistry.enable(id);
    const plugin = pluginRegistry.getById(id);
    res.json({ plugin });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/plugins/:id/disable
 * Disable a plugin.
 */
router.post('/:id/disable', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getIdParam(req);
    pluginRegistry.disable(id);
    const plugin = pluginRegistry.getById(id);
    res.json({ plugin });
  } catch (err) {
    next(err);
  }
});

export { router as pluginRouter };
