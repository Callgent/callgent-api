import { Module } from '@nestjs/common';
import { EntriesModule } from '../entries/entries.module';
import { UsersModule } from '../users/users.module';
import { CallgentRealmsController } from './callgent-realms.controller';
import { CallgentRealmsService } from './callgent-realms.service';
import { ApiKeyAuthProcessor } from './processors/api-key-auth.processor';
import { HttpAuthProcessor } from './processors/http-auth.processor';

@Module({
  imports: [EntriesModule, UsersModule],
  providers: [
    { provide: 'CallgentRealmsService', useClass: CallgentRealmsService },
    { provide: 'apiKey-authProcessor', useClass: ApiKeyAuthProcessor },
    { provide: 'http-authProcessor', useClass: HttpAuthProcessor },
  ],
  controllers: [CallgentRealmsController],
  exports: ['CallgentRealmsService'],
})
export class CallgentRealmsModule {}
