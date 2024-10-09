import { Module } from '@nestjs/common';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { UsersModule } from '../users/users.module';
import { CallgentRealmsController } from './callgent-realms.controller';
import { CallgentRealmsService } from './callgent-realms.service';
import { ApiKeyAuthProcessor } from './processors/api-key-auth.processor';
import { HttpAuthProcessor } from './processors/http-auth.processor';

@Module({
  imports: [EndpointsModule, UsersModule],
  providers: [
    { provide: 'CallgentRealmsService', useClass: CallgentRealmsService },
    { provide: 'apiKey-authProcessor', useClass: ApiKeyAuthProcessor },
    { provide: 'http-authProcessor', useClass: HttpAuthProcessor },
  ],
  exports: ['CallgentRealmsService'],
  controllers: [CallgentRealmsController],
})
export class CallgentRealmsModule {}
