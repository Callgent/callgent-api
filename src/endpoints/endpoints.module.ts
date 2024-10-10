import { Module } from '@nestjs/common';
import { CallgentRealmsModule } from '../callgent-realms/callgent-realms.module';
import { EntriesModule } from '../entries/entries.module';
import { EndpointsController } from './endpoints.controller';
import { EndpointsService } from './endpoints.service';

@Module({
  imports: [EntriesModule, CallgentRealmsModule],
  providers: [
    { provide: 'EndpointsService', useClass: EndpointsService },
  ],
  controllers: [EndpointsController],
  exports: ['EndpointsService'],
})
export class EndpointsModule {}
