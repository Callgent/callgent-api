import { Module } from '@nestjs/common';
import { CallgentFunctionsModule } from '../callgent-functions/callgent-functions.module';
import { CallgentRealmsModule } from '../callgent-realms/callgent-realms.module';
import { CallgentsModule } from '../callgents/callgents.module';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { CallgentHubController } from './callgent-hub.controller';
import { CallgentHubService } from './callgent-hub.service';

@Module({
  imports: [
    CallgentsModule,
    CallgentRealmsModule,
    EndpointsModule,
    CallgentFunctionsModule,
  ],
  controllers: [CallgentHubController],
  providers: [CallgentHubService],
})
export class CallgentHubModule {}
