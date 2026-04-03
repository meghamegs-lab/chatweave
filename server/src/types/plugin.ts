import { z } from 'zod';

export const toolParameterSchema = z.object({
  type: z.literal('object'),
  properties: z.record(z.any()).default({}),
  required: z.array(z.string()).optional(),
});

export const pluginToolSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/),
  description: z.string().min(1).max(500),
  parameters: toolParameterSchema,
});

export const pluginManifestSchema = z.object({
  id: z.string().min(1).max(100).regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1).max(200),
  version: z.string().default('1.0.0'),
  description: z.string().optional(),
  iframe_url: z.string(),
  icon_url: z.string().url().optional(),
  category: z.enum(['games', 'tools', 'education', 'media', 'productivity']).optional(),
  auth_type: z.enum(['none', 'api_key', 'oauth2']).default('none'),
  oauth_config: z.object({
    auth_url: z.string().url(),
    token_url: z.string().url(),
    scopes: z.array(z.string()),
    client_id: z.string(),
  }).optional(),
  tools: z.array(pluginToolSchema).min(1),
  completion_events: z.array(z.string()).default([]),
  sandbox: z.object({
    permissions: z.array(z.enum(['allow-scripts', 'allow-popups'])).default(['allow-scripts']),
  }).default({ permissions: ['allow-scripts'] }),
  ui: z.object({
    default_height: z.number().positive().default(400),
    max_height: z.number().positive().default(800),
    resizable: z.boolean().default(true),
  }).default({ default_height: 400, max_height: 800, resizable: true }),
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;
export type PluginTool = z.infer<typeof pluginToolSchema>;
