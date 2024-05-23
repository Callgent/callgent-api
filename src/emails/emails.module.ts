import { Global, Module } from '@nestjs/common';
import { EmailTemplateProvider } from './email-template.provider';
import { EmailsService } from './emails.service';

@Global()
@Module({
  providers: [EmailsService, EmailTemplateProvider],
  exports: [EmailsService],
})
export class EmailsModule {}
