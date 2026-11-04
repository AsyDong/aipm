import type {
  GameContext,
  IPlugin,
  PluginDefinition,
} from '@english/contracts';

export class SceneManager {
  private current: IPlugin | undefined;
  constructor(private create: (definition: PluginDefinition) => IPlugin) {}
  async load(definition: PluginDefinition, context: GameContext) {
    await this.unload();
    const plugin = this.create(definition);
    this.current = plugin;
    try {
      await plugin.initialize(context, definition.config);
    } catch (error) {
      await this.unload();
      throw error;
    }
  }
  async start() {
    if (!this.current) throw new Error('Scene not loaded');
    await this.current.start();
  }
  pause() {
    this.current?.pause();
  }
  resume() {
    this.current?.resume();
  }
  async unload() {
    const plugin = this.current;
    this.current = undefined;
    await plugin?.destroy();
  }
  getCurrentScene() {
    return this.current ?? null;
  }
}
