import Ajv2020 from 'ajv/dist/2020';
import type {
  GameDefinition,
  PluginRegistration,
  ValidationResult,
  PluginDefinition,
} from '@english/contracts';
import schema from '../../../schemas/game-definition.schema.json';

export class PluginManager {
  private ajv = new Ajv2020({ allErrors: true });
  private validateDefinition = this.ajv.compile<GameDefinition>(schema);
  private plugins = new Map<string, PluginRegistration>();
  register(plugin: PluginRegistration) {
    if (this.plugins.has(plugin.metadata.id))
      throw new Error(`Duplicate plugin: ${plugin.metadata.id}`);
    if (
      plugin.metadata.apiVersion !== '1.0.0' ||
      !/^\d+\.\d+\.\d+$/.test(plugin.metadata.version)
    )
      throw new Error('Unsupported plugin version');
    this.ajv.compile(plugin.metadata.configSchema);
    this.plugins.set(plugin.metadata.id, plugin);
  }
  get(id: string) {
    return this.plugins.get(id);
  }
  validate(input: unknown): ValidationResult {
    if (!this.validateDefinition(input))
      return {
        valid: false,
        errors: (this.validateDefinition.errors ?? []).map(
          (e) => `${e.instancePath} ${e.message}`,
        ),
      };
    const game = input as GameDefinition;
    const errors: string[] = [];
    for (const [type, spec] of [
      ['SCENE', game.scene],
      ['MECHANIC', game.mechanic],
    ] as const) {
      const plugin = this.get(spec.id);
      if (!plugin || plugin.metadata.type !== type) {
        errors.push(`Unknown ${type}: ${spec.id}`);
        continue;
      }
      if (plugin.metadata.version !== spec.version)
        errors.push(`Version mismatch: ${spec.id}`);
      if (!this.ajv.validate(plugin.metadata.configSchema, spec.config))
        errors.push(`Invalid config: ${spec.id}`);
    }
    const scene = this.get(game.scene.id);
    const mechanic = this.get(game.mechanic.id);
    for (const capability of mechanic?.metadata.requiredCapabilities ?? []) {
      if (!scene?.metadata.capabilities.includes(capability))
        errors.push(`Missing scene capability: ${capability}`);
    }
    return { valid: errors.length === 0, errors };
  }
  create(definition: PluginDefinition) {
    const registration = this.get(definition.id);
    if (!registration) throw new Error(`Unknown plugin: ${definition.id}`);
    return registration.create();
  }
}
