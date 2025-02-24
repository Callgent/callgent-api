import { Global, Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { LLMService } from './llm.service';
import { ScriptAgentService } from './script-agent.service';

@Global()
@Module({
  providers: [
    { provide: 'AgentsService', useClass: AgentsService },
    LLMService,
    { provide: 'ScriptAgentService', useClass: ScriptAgentService },
    LLMService,
  ],
  exports: ['AgentsService', 'ScriptAgentService'],
})
export class AgentsModule {}
