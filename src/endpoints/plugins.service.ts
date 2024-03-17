import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

@Injectable()
export class PluginsService {
  constructor(private readonly moduleRef: ModuleRef) {}

  getPlugin<T>(pluginType: string): T {
    const name = `${pluginType}Plugin`;
    const plugin = this.moduleRef.get(name);
    if (!plugin) throw new NotFoundException('no plugin found:' + pluginType);
    return plugin;
  }
}
