import { Global, Module } from '@nestjs/common';
import { EmailTemplateProvider } from './email-template.provider';
import { EmailsController } from './emails.controller';
import { EmailsService } from './emails.service';
import { RequestRelayListener } from './listeners/request-relay-event.listener';

@Global()
@Module({
  providers: [EmailsService, EmailTemplateProvider, RequestRelayListener],
  exports: [EmailsService],
  controllers: [EmailsController],
})
export class EmailsModule {}
