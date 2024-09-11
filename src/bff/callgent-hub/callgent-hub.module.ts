import { Module } from '@nestjs/common';
import { CallgentsModule } from '../../callgents/callgents.module';
import { CallgentHubController } from './callgent-hub.controller';

@Module({
  imports: [CallgentsModule],
  controllers: [CallgentHubController],
})
export class CallgentHubModule {}
