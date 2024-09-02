import { Global, Module } from '@nestjs/common';
import { EmailTemplateProvider } from './email-template.provider';
import { EmailsService } from './emails.service';
import { EmailsController } from './emails.controller';

@Global()
@Module({
  providers: [EmailsService, EmailTemplateProvider],
  exports: [EmailsService],
  controllers: [EmailsController],
})
export class EmailsModule {}
