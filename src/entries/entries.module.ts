import { Module } from '@nestjs/common';
import { CallgentsModule } from '../callgents/callgents.module';
import { EmailAdaptor } from './adaptors/builtin/email/email.adaptor';
import { RestAPIAdaptor } from './adaptors/builtin/restapi/restapi.adaptor';
import { RestApiController } from './adaptors/builtin/restapi/restapi.controller';
import { WebpageAdaptor } from './adaptors/builtin/web/webpage.adaptor';
import { EntriesController } from './entries.controller';
import { EntriesService } from './entries.service';
import { CallgentCreatedListener } from './listeners/callgent-created.listener';

@Module({
  imports: [CallgentsModule],
  providers: [
    { provide: 'EntriesService', useClass: EntriesService },
    CallgentCreatedListener,
    {
      provide: 'restAPI-EntryAdaptor',
      useClass: RestAPIAdaptor,
    },
    {
      provide: 'Webpage-EntryAdaptor',
      useClass: WebpageAdaptor,
    },
    {
      provide: 'Email-EntryAdaptor',
      useClass: EmailAdaptor,
    },
  ],
  controllers: [EntriesController, RestApiController],
  exports: ['EntriesService'],
})
export class EntriesModule {}
