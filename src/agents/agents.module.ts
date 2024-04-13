import { Global, Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { LLMService } from './llm.service';

@Global()
@Module({
  providers: [AgentsService, LLMService],
  exports: [AgentsService],
})
export class AgentsModule {}
