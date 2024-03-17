import { Logger, Provider } from '@nestjs/common';
import { glob } from 'glob';

const logger = new Logger('LoadPlugins');

/**
 * @param paths plugin paths in order
 */
export const loadPlugins = async (paths: string[]) => {
  // Feel free to change path if your structure is different
  const pluginsRelativePathWithoutExt = paths
    .reduce((pres, val) => [...glob.sync(val), ...pres], [])
    .map((path) => path.replace('src/', './../'))
    .map((path) => path.replace('.ts', '.js'));

  const pluginProviders: Provider<any>[] = [];
  const pluginTypes = new Set();
  for (const modulePath of pluginsRelativePathWithoutExt) {
    const modules = await import(modulePath);
    // Might be different if you are using default export instead
    const plugin = modules[Object.keys(modules)[0]];
    const pluginType = plugin.prototype.pluginType();
    if (!pluginType) {
      logger.error(`Plugin must have a protocol, ignoring ${modulePath}`);
      continue;
    }
    if (pluginTypes.has(pluginType)) {
      logger.error(
        `Duplicate plugins with name: "${pluginType}", ignoring ${modulePath}`,
      );
      continue;
    }

    pluginTypes.add(pluginType);
    logger.warn(`Loading plugin: ${pluginType} - ${plugin.name}`);
    pluginProviders.push({
      provide: `_-plugin-${pluginType}`,
      useClass: plugin,
    });
  }
  return pluginProviders;
};
