import { Module } from '@nestjs/common';
import { EntriesModule } from '../entries/entries.module';
import { UsersModule } from '../users/users.module';
import { CallgentRealmsController } from './callgent-realms.controller';
import { CallgentRealmsService } from './callgent-realms.service';
import { CallgentCreatedListener } from './listeners/callgent-created.listener';
import { ApiKeyAuthProcessor } from './processors/api-key-auth.processor';
import { HttpAuthProcessor } from './processors/http-auth.processor';
import { JwtAuthProcessor } from './processors/jwt-auth.processor';

@Module({
  imports: [EntriesModule, UsersModule],
  providers: [
    { provide: 'CallgentRealmsService', useClass: CallgentRealmsService },
    { provide: 'jwt-authProcessor', useClass: JwtAuthProcessor },
    { provide: 'apiKey-authProcessor', useClass: ApiKeyAuthProcessor },
    { provide: 'http-authProcessor', useClass: HttpAuthProcessor },
    CallgentCreatedListener,
  ],
  controllers: [CallgentRealmsController],
  exports: ['CallgentRealmsService'],
})
export class CallgentRealmsModule {}
