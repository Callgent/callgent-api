import { Module } from '@nestjs/common';
import { AuthTokensModule } from '../auth-tokens/auth-tokens.module';
import { PluginsModule } from '../endpoints/plugins.module';
import { TasksModule } from '../tasks/tasks.module';
import { CallerController } from './caller.controller';

@Module({
  imports: [TasksModule, PluginsModule, AuthTokensModule],
  controllers: [CallerController],
})
export class CallerModule {}
