import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db';
import { pluginManifestSchema, PluginManifest, PluginTool } from '../types/plugin';
import { AppError } from '../middleware/errorHandler';

export interface Plugin extends PluginManifest {
  is_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();

  /**
   * Load all plugins from the database into memory.
   * Should be called once during server startup after DB is initialized.
   */
  loadFromDatabase(): void {
    const db = getDatabase();

    const rows = db.prepare('SELECT * FROM plugins').all() as Array<{
      id: string;
      name: string;
      version: string;
      description: string | null;
      iframe_url: string;
      icon_url: string | null;
      category: string | null;
      auth_type: string;
      manifest: string;
      is_enabled: number;
      created_at: string;
      updated_at: string;
    }>;

    for (const row of rows) {
      const manifest = JSON.parse(row.manifest) as PluginManifest;
      this.plugins.set(row.id, {
        ...manifest,
        is_enabled: row.is_enabled === 1,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    }

    console.log(`[PluginRegistry] Loaded ${this.plugins.size} plugin(s) from database`);
  }

  /**
   * Register a new plugin from a manifest. Validates with Zod, saves to DB and cache.
   * Throws AppError(409) if a plugin with the same ID already exists.
   */
  register(rawManifest: unknown): Plugin {
    const parsed = pluginManifestSchema.safeParse(rawManifest);
    if (!parsed.success) {
      throw new AppError(
        `Invalid plugin manifest: ${parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
        400,
        'INVALID_MANIFEST'
      );
    }

    const manifest = parsed.data;

    if (this.plugins.has(manifest.id)) {
      throw new AppError(
        `Plugin with id "${manifest.id}" is already registered`,
        409,
        'PLUGIN_EXISTS'
      );
    }

    const db = getDatabase();
    const now = new Date().toISOString();

    // Insert plugin row
    db.prepare(`
      INSERT INTO plugins (id, name, version, description, iframe_url, icon_url, category, auth_type, manifest, is_enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      manifest.id,
      manifest.name,
      manifest.version,
      manifest.description ?? null,
      manifest.iframe_url,
      manifest.icon_url ?? null,
      manifest.category ?? null,
      manifest.auth_type,
      JSON.stringify(manifest),
      now,
      now
    );

    // Insert tools
    const insertTool = db.prepare(`
      INSERT INTO plugin_tools (id, plugin_id, name, description, parameters)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const tool of manifest.tools) {
      insertTool.run(
        uuidv4(),
        manifest.id,
        tool.name,
        tool.description,
        JSON.stringify(tool.parameters)
      );
    }

    const plugin: Plugin = {
      ...manifest,
      is_enabled: true,
      created_at: now,
      updated_at: now,
    };

    this.plugins.set(manifest.id, plugin);
    console.log(`[PluginRegistry] Registered plugin: ${manifest.name} (${manifest.id})`);

    return plugin;
  }

  /**
   * Get all registered plugins.
   */
  getAll(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get a single plugin by ID.
   */
  getById(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }

  /**
   * Get all enabled plugins.
   */
  getEnabled(): Plugin[] {
    return Array.from(this.plugins.values()).filter(p => p.is_enabled);
  }

  /**
   * Get all tools from enabled plugins, each annotated with its plugin ID.
   */
  getToolsForEnabledPlugins(): Array<{ pluginId: string; tool: PluginTool }> {
    const result: Array<{ pluginId: string; tool: PluginTool }> = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.is_enabled) {
        for (const tool of plugin.tools) {
          result.push({ pluginId: plugin.id, tool });
        }
      }
    }
    return result;
  }

  /**
   * Enable a plugin by ID.
   */
  enable(id: string): void {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      throw new AppError(`Plugin "${id}" not found`, 404, 'PLUGIN_NOT_FOUND');
    }

    const db = getDatabase();
    db.prepare('UPDATE plugins SET is_enabled = 1, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id);

    plugin.is_enabled = true;
    console.log(`[PluginRegistry] Enabled plugin: ${id}`);
  }

  /**
   * Disable a plugin by ID.
   */
  disable(id: string): void {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      throw new AppError(`Plugin "${id}" not found`, 404, 'PLUGIN_NOT_FOUND');
    }

    const db = getDatabase();
    db.prepare('UPDATE plugins SET is_enabled = 0, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id);

    plugin.is_enabled = false;
    console.log(`[PluginRegistry] Disabled plugin: ${id}`);
  }

  /**
   * Update a plugin's manifest. Re-validates, updates DB and cache.
   */
  update(id: string, rawManifest: unknown): Plugin {
    const existing = this.plugins.get(id);
    if (!existing) {
      throw new AppError(`Plugin "${id}" not found`, 404, 'PLUGIN_NOT_FOUND');
    }

    const parsed = pluginManifestSchema.safeParse(rawManifest);
    if (!parsed.success) {
      throw new AppError(
        `Invalid plugin manifest: ${parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
        400,
        'INVALID_MANIFEST'
      );
    }

    const manifest = parsed.data;

    // Ensure the ID in the manifest matches the route param
    if (manifest.id !== id) {
      throw new AppError(
        `Manifest id "${manifest.id}" does not match route id "${id}"`,
        400,
        'ID_MISMATCH'
      );
    }

    const db = getDatabase();
    const now = new Date().toISOString();

    // Update plugin row
    db.prepare(`
      UPDATE plugins
      SET name = ?, version = ?, description = ?, iframe_url = ?, icon_url = ?, category = ?, auth_type = ?, manifest = ?, updated_at = ?
      WHERE id = ?
    `).run(
      manifest.name,
      manifest.version,
      manifest.description ?? null,
      manifest.iframe_url,
      manifest.icon_url ?? null,
      manifest.category ?? null,
      manifest.auth_type,
      JSON.stringify(manifest),
      now,
      id
    );

    // Replace tools: delete old, insert new
    db.prepare('DELETE FROM plugin_tools WHERE plugin_id = ?').run(id);

    const insertTool = db.prepare(`
      INSERT INTO plugin_tools (id, plugin_id, name, description, parameters)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const tool of manifest.tools) {
      insertTool.run(
        uuidv4(),
        id,
        tool.name,
        tool.description,
        JSON.stringify(tool.parameters)
      );
    }

    const plugin: Plugin = {
      ...manifest,
      is_enabled: existing.is_enabled,
      created_at: existing.created_at,
      updated_at: now,
    };

    this.plugins.set(id, plugin);
    console.log(`[PluginRegistry] Updated plugin: ${manifest.name} (${id})`);

    return plugin;
  }

  /**
   * Remove a plugin by ID. Deletes from DB and cache.
   */
  remove(id: string): void {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      throw new AppError(`Plugin "${id}" not found`, 404, 'PLUGIN_NOT_FOUND');
    }

    const db = getDatabase();
    // plugin_tools will cascade-delete thanks to FK
    db.prepare('DELETE FROM plugins WHERE id = ?').run(id);

    this.plugins.delete(id);
    console.log(`[PluginRegistry] Removed plugin: ${id}`);
  }

  /**
   * Register bundled plugins if they don't already exist in the database.
   * Skips plugins that are already registered (idempotent).
   */
  registerBundled(manifests: PluginManifest[]): void {
    let registered = 0;
    let skipped = 0;

    for (const manifest of manifests) {
      if (this.plugins.has(manifest.id)) {
        skipped++;
        continue;
      }

      try {
        this.register(manifest);
        registered++;
      } catch (err) {
        console.error(`[PluginRegistry] Failed to register bundled plugin "${manifest.id}":`, err);
      }
    }

    console.log(`[PluginRegistry] Bundled plugins: ${registered} registered, ${skipped} already existed`);
  }
}

// Singleton instance
export const pluginRegistry = new PluginRegistry();
