import { Module } from '@nestjs/common';
import { MailPlugin4Postmark } from './builtin/mail.plugin';
import { PluginsService } from './plugins.service';

@Module({
  providers: [
    {
      provide: 'mailPlugin',
      useClass: MailPlugin4Postmark,
    },
    PluginsService,
  ],
  exports: [PluginsService, 'mailPlugin'],
})
export class PluginsModule {
  // static async forRootAsync(): Promise<DynamicModule> {
  //   const pluginProviders = await loadPlugins([
  //     'src/plugins/3rd/**/*.plugin.ts',
  //     'src/plugins/builtin/**/*.plugin.ts',
  //   ]);
  //   return {
  //     module: PluginsModule,
  //     providers: [...pluginProviders, PluginsService],
  //     exports: [PluginsService],
  //     global: true,
  //   };
  // }
}
