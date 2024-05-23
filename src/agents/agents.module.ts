import { Global, Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { LLMService } from './llm.service';

@Global()
@Module({
  providers: [
    { provide: 'AgentsService', useClass: AgentsService },
    LLMService,
  ],
  exports: ['AgentsService'],
})
export class AgentsModule {}
