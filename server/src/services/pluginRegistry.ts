import { v4 as uuidv4 } from 'uuid';
import { query, queryAll } from '../db';
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
  async loadFromDatabase(): Promise<void> {
    const rows = await queryAll<{
      id: string;
      name: string;
      version: string;
      description: string | null;
      iframe_url: string;
      icon_url: string | null;
      category: string | null;
      auth_type: string;
      manifest: string;
      is_enabled: boolean;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM plugins');

    for (const row of rows) {
      const manifest = JSON.parse(row.manifest) as PluginManifest;
      this.plugins.set(row.id, {
        ...manifest,
        is_enabled: row.is_enabled,
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
  async register(rawManifest: unknown): Promise<Plugin> {
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

    const now = new Date().toISOString();

    // Insert plugin row
    await query(`
      INSERT INTO plugins (id, name, version, description, iframe_url, icon_url, category, auth_type, manifest, is_enabled, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10, $11)
    `, [
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
    ]);

    // Insert tools
    for (const tool of manifest.tools) {
      await query(`
        INSERT INTO plugin_tools (id, plugin_id, name, description, parameters)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        uuidv4(),
        manifest.id,
        tool.name,
        tool.description,
        JSON.stringify(tool.parameters)
      ]);
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
  async enable(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      throw new AppError(`Plugin "${id}" not found`, 404, 'PLUGIN_NOT_FOUND');
    }

    await query('UPDATE plugins SET is_enabled = TRUE, updated_at = $1 WHERE id = $2',
      [new Date().toISOString(), id]);

    plugin.is_enabled = true;
    console.log(`[PluginRegistry] Enabled plugin: ${id}`);
  }

  /**
   * Disable a plugin by ID.
   */
  async disable(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      throw new AppError(`Plugin "${id}" not found`, 404, 'PLUGIN_NOT_FOUND');
    }

    await query('UPDATE plugins SET is_enabled = FALSE, updated_at = $1 WHERE id = $2',
      [new Date().toISOString(), id]);

    plugin.is_enabled = false;
    console.log(`[PluginRegistry] Disabled plugin: ${id}`);
  }

  /**
   * Update a plugin's manifest. Re-validates, updates DB and cache.
   */
  async update(id: string, rawManifest: unknown): Promise<Plugin> {
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

    const now = new Date().toISOString();

    // Update plugin row
    await query(`
      UPDATE plugins
      SET name = $1, version = $2, description = $3, iframe_url = $4, icon_url = $5, category = $6, auth_type = $7, manifest = $8, updated_at = $9
      WHERE id = $10
    `, [
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
    ]);

    // Replace tools: delete old, insert new
    await query('DELETE FROM plugin_tools WHERE plugin_id = $1', [id]);

    for (const tool of manifest.tools) {
      await query(`
        INSERT INTO plugin_tools (id, plugin_id, name, description, parameters)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        uuidv4(),
        id,
        tool.name,
        tool.description,
        JSON.stringify(tool.parameters)
      ]);
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
  async remove(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      throw new AppError(`Plugin "${id}" not found`, 404, 'PLUGIN_NOT_FOUND');
    }

    // plugin_tools will cascade-delete thanks to FK
    await query('DELETE FROM plugins WHERE id = $1', [id]);

    this.plugins.delete(id);
    console.log(`[PluginRegistry] Removed plugin: ${id}`);
  }

  /**
   * Register bundled plugins if they don't already exist in the database.
   * Skips plugins that are already registered (idempotent).
   */
  async registerBundled(manifests: PluginManifest[]): Promise<void> {
    let registered = 0;
    let skipped = 0;

    for (const manifest of manifests) {
      if (this.plugins.has(manifest.id)) {
        skipped++;
        continue;
      }

      try {
        await this.register(manifest);
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
