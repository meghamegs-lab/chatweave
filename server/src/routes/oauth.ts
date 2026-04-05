import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, queryAll } from '../db';
import { authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { pluginRegistry } from '../services/pluginRegistry';

const router = Router();

// All OAuth routes require authentication
router.use(authMiddleware);

// GET /api/oauth/status - Get OAuth connection status for all plugins
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokens = await queryAll<{
      plugin_id: string;
      created_at: string;
      updated_at: string;
    }>(
      'SELECT plugin_id, created_at, updated_at FROM oauth_tokens WHERE user_id = $1',
      [req.user!.userId]
    );

    const connections = tokens.map(t => ({
      pluginId: t.plugin_id,
      connected: true,
      connectedAt: t.created_at,
    }));

    res.json({ connections });
  } catch (err) {
    next(err);
  }
});

// GET /api/oauth/:pluginId/authorize - Start OAuth flow
router.get('/:pluginId/authorize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pluginId = req.params.pluginId as string;
    const plugin = pluginRegistry.getById(pluginId);

    if (!plugin) {
      throw new AppError('Plugin not found', 404, 'PLUGIN_NOT_FOUND');
    }

    if (plugin.auth_type !== 'oauth2' || !plugin.oauth_config) {
      throw new AppError('Plugin does not use OAuth2', 400, 'NOT_OAUTH');
    }

    const state = uuidv4();

    // Store state for CSRF protection
    await query(`
      INSERT INTO oauth_tokens (id, user_id, plugin_id, access_token, refresh_token, expires_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, plugin_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        updated_at = EXCLUDED.updated_at
    `, [
      uuidv4(),
      req.user!.userId,
      pluginId,
      `pending:${state}`, // temporary state token
      null,
      null,
      new Date().toISOString(),
      new Date().toISOString()
    ]);

    const authUrl = new URL(plugin.oauth_config.auth_url);
    authUrl.searchParams.set('client_id', plugin.oauth_config.client_id);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', `http://localhost:3001/api/oauth/${pluginId}/callback`);
    authUrl.searchParams.set('scope', plugin.oauth_config.scopes.join(' '));
    authUrl.searchParams.set('state', state);

    res.json({ authUrl: authUrl.toString(), state });
  } catch (err) {
    next(err);
  }
});

// GET /api/oauth/:pluginId/callback - OAuth callback
router.get('/:pluginId/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pluginId = req.params.pluginId as string;
    const { code, state } = req.query;

    if (!code || !state) {
      throw new AppError('Missing code or state', 400, 'INVALID_CALLBACK');
    }

    const plugin = pluginRegistry.getById(pluginId);
    if (!plugin || !plugin.oauth_config) {
      throw new AppError('Plugin not found', 404, 'PLUGIN_NOT_FOUND');
    }

    // Exchange code for token (simplified — in production, would use plugin's token_url)
    const now = new Date().toISOString();

    await query(`
      UPDATE oauth_tokens
      SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = $4
      WHERE user_id = $5 AND plugin_id = $6
    `, [
      `mock_access_token_${pluginId}_${Date.now()}`,
      `mock_refresh_token_${pluginId}_${Date.now()}`,
      new Date(Date.now() + 3600 * 1000).toISOString(),
      now,
      req.user!.userId,
      pluginId
    ]);

    // Return HTML that closes the popup
    res.send(`
      <html><body>
        <script>
          window.opener && window.opener.postMessage({ type: 'OAUTH_COMPLETE', pluginId: '${pluginId}' }, '*');
          window.close();
        </script>
        <p>Authentication successful! You can close this window.</p>
      </body></html>
    `);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/oauth/:pluginId - Disconnect OAuth
router.delete('/:pluginId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pluginId = req.params.pluginId as string;

    await query('DELETE FROM oauth_tokens WHERE user_id = $1 AND plugin_id = $2',
      [req.user!.userId, pluginId]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export { router as oauthRouter };
