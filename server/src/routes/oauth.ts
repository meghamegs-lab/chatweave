import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, queryAll } from '../db';
import { authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { pluginRegistry } from '../services/pluginRegistry';

const router = Router();

// OAuth callback does NOT require auth (browser redirect from Google)
// GET /api/oauth/:pluginId/callback - OAuth callback
router.get('/:pluginId/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pluginId = req.params.pluginId as string;
    const { code, state } = req.query;

    const plugin = pluginRegistry.getById(pluginId);
    if (!plugin || !plugin.oauth_config) {
      throw new AppError('Plugin not found', 404, 'PLUGIN_NOT_FOUND');
    }

    // In production: exchange code for token using plugin's token_url
    // For demo: mock the token
    const now = new Date().toISOString();

    // Return HTML that notifies the opener and closes the popup
    res.send(`
      <html><body>
        <script>
          window.opener && window.opener.postMessage({ type: 'OAUTH_COMPLETE', pluginId: '${pluginId}' }, '*');
          setTimeout(function() { window.close(); }, 1000);
        </script>
        <p>Authentication successful! This window will close automatically.</p>
      </body></html>
    `);
  } catch (err) {
    next(err);
  }
});

// GET /api/oauth/:pluginId/demo-login - Simulated Google sign-in page for demo mode
router.get('/:pluginId/demo-login', async (req: Request, res: Response) => {
  const pluginId = req.params.pluginId as string;
  const plugin = pluginRegistry.getById(pluginId);
  const pluginName = plugin?.name || pluginId;

  res.send(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in - Google Accounts</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Google Sans', Roboto, Arial, sans-serif; background: #f8f9fa; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  .card { background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.14); padding: 48px 40px 36px; width: 400px; text-align: center; }
  .google-logo { font-size: 24px; margin-bottom: 8px; }
  .google-logo span:nth-child(1) { color: #4285F4; }
  .google-logo span:nth-child(2) { color: #EA4335; }
  .google-logo span:nth-child(3) { color: #FBBC05; }
  .google-logo span:nth-child(4) { color: #4285F4; }
  .google-logo span:nth-child(5) { color: #34A853; }
  .google-logo span:nth-child(6) { color: #EA4335; }
  h1 { font-size: 24px; font-weight: 400; color: #202124; margin: 16px 0 8px; }
  .subtitle { font-size: 16px; color: #5f6368; margin-bottom: 32px; }
  .account { display: flex; align-items: center; gap: 16px; padding: 12px 16px; border: 1px solid #dadce0; border-radius: 8px; cursor: pointer; transition: background 0.2s; margin-bottom: 12px; text-align: left; width: 100%; background: #fff; }
  .account:hover { background: #f1f3f4; }
  .avatar { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 500; color: #fff; flex-shrink: 0; }
  .account-info { flex: 1; }
  .account-name { font-size: 14px; color: #202124; font-weight: 500; }
  .account-email { font-size: 12px; color: #5f6368; }
  .divider { display: flex; align-items: center; gap: 16px; margin: 20px 0; color: #5f6368; font-size: 12px; }
  .divider::before, .divider::after { content: ''; flex: 1; border-top: 1px solid #dadce0; }
  .another { color: #1a73e8; font-size: 14px; font-weight: 500; cursor: pointer; padding: 8px 0; display: inline-block; }
  .another:hover { background: #f1f8ff; border-radius: 4px; padding: 8px 12px; }
  .footer { font-size: 12px; color: #5f6368; margin-top: 32px; }
  .footer a { color: #1a73e8; text-decoration: none; }
  .spinner { display: none; margin: 20px auto; width: 36px; height: 36px; border: 3px solid #e8eaed; border-top-color: #1a73e8; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .signing-in { display: none; color: #5f6368; font-size: 14px; margin-top: 12px; }
</style>
</head><body>
<div class="card">
  <div class="google-logo"><span>G</span><span>o</span><span>o</span><span>g</span><span>l</span><span>e</span></div>
  <h1>Choose an account</h1>
  <p class="subtitle">to continue to ${pluginName}</p>

  <button class="account" onclick="selectAccount('teacher@school.edu', 'Ms. Teacher')">
    <div class="avatar" style="background:#7c4dff">T</div>
    <div class="account-info">
      <div class="account-name">Ms. Teacher</div>
      <div class="account-email">teacher@school.edu</div>
    </div>
  </button>

  <button class="account" onclick="selectAccount('student@school.edu', 'Alex Student')">
    <div class="avatar" style="background:#00bcd4">A</div>
    <div class="account-info">
      <div class="account-name">Alex Student</div>
      <div class="account-email">student@school.edu</div>
    </div>
  </button>

  <button class="account" onclick="selectAccount('parent@gmail.com', 'Jamie Parent')">
    <div class="avatar" style="background:#ff7043">J</div>
    <div class="account-info">
      <div class="account-name">Jamie Parent</div>
      <div class="account-email">parent@gmail.com</div>
    </div>
  </button>

  <div class="divider">or</div>
  <div class="another" onclick="selectAccount('demo@chatweave.app', 'Demo User')">Use another account</div>

  <div class="spinner" id="spinner"></div>
  <div class="signing-in" id="signing-in">Signing in...</div>

  <div class="footer">
    <a href="#">English (United States)</a> &nbsp;·&nbsp;
    <a href="#">Help</a> &nbsp;·&nbsp;
    <a href="#">Privacy</a> &nbsp;·&nbsp;
    <a href="#">Terms</a>
  </div>
</div>
<script>
function selectAccount(email, name) {
  document.querySelectorAll('.account').forEach(el => el.style.display = 'none');
  document.querySelector('.divider').style.display = 'none';
  document.querySelector('.another').style.display = 'none';
  document.querySelector('.subtitle').textContent = 'Signing in as ' + email;
  document.getElementById('spinner').style.display = 'block';
  document.getElementById('signing-in').style.display = 'block';

  setTimeout(function() {
    window.location.href = '/api/oauth/${pluginId}/callback?code=demo_auth_code&state=demo';
  }, 1500);
}
</script>
</body></html>`);
});

// All remaining OAuth routes require authentication
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
