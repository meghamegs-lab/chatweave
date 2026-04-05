CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  metadata TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS plugins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  description TEXT,
  iframe_url TEXT NOT NULL,
  icon_url TEXT,
  category TEXT,
  auth_type TEXT NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none', 'api_key', 'oauth2')),
  manifest TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_tools (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plugin_id TEXT NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  parameters TEXT NOT NULL,
  UNIQUE(plugin_id, name)
);
CREATE INDEX IF NOT EXISTS idx_plugin_tools_plugin ON plugin_tools(plugin_id);

CREATE TABLE IF NOT EXISTS tool_invocations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  plugin_id TEXT NOT NULL REFERENCES plugins(id),
  tool_name TEXT NOT NULL,
  parameters TEXT,
  result TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'error', 'timeout')),
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invocations_session ON tool_invocations(session_id);

CREATE TABLE IF NOT EXISTS plugin_instances (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  plugin_id TEXT NOT NULL REFERENCES plugins(id),
  state TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'error')),
  completion_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plugin_id TEXT NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  scopes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plugin_id)
);

-- Plugin rules that apps must comply with
CREATE TABLE IF NOT EXISTS plugin_rules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Violations logged against plugins
CREATE TABLE IF NOT EXISTS plugin_violations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plugin_id TEXT NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  rule_id TEXT REFERENCES plugin_rules(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  action_taken TEXT NOT NULL DEFAULT 'flagged' CHECK (action_taken IN ('flagged', 'disabled', 'removed')),
  reported_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_violations_plugin ON plugin_violations(plugin_id);

-- Plugin registration requests (pending approval)
CREATE TABLE IF NOT EXISTS plugin_submissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  manifest TEXT NOT NULL,
  submitted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_notes TEXT,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default plugin rules (idempotent)
INSERT INTO plugin_rules (id, title, description, severity)
VALUES
  ('rule-age-appropriate', 'Age-Appropriate Content', 'All content must be appropriate for the target age group (K-12 students). No violence, adult themes, or inappropriate language.', 'critical'),
  ('rule-data-privacy', 'Data Privacy', 'Plugins must not collect, store, or transmit personally identifiable information (PII) of minors without consent.', 'critical'),
  ('rule-no-ads', 'No Advertisements', 'Plugins must not display third-party advertisements or promote commercial products to students.', 'critical'),
  ('rule-educational', 'Educational Value', 'Plugins must provide genuine educational value aligned with learning objectives. No purely entertainment content.', 'warning'),
  ('rule-accessibility', 'Accessibility Standards', 'Plugins must support screen readers, keyboard navigation, and maintain minimum contrast ratios (WCAG 2.1 AA).', 'warning'),
  ('rule-performance', 'Performance Standards', 'Plugins must load within 5 seconds, not exceed 50MB memory usage, and not cause UI freezes.', 'warning'),
  ('rule-sandbox', 'Sandbox Compliance', 'Plugins must operate within their iframe sandbox. No attempts to access parent window data or break out of sandbox.', 'critical'),
  ('rule-offline', 'Offline Graceful Degradation', 'Plugins should handle network interruptions gracefully without data loss.', 'info')
ON CONFLICT (id) DO NOTHING;
