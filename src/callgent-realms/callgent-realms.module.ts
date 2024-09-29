import { Module } from '@nestjs/common';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { UsersModule } from '../users/users.module';
import { CallgentRealmsController } from './callgent-realms.controller';
import { CallgentRealmsService } from './callgent-realms.service';
import { ApiKeyAuthProcessor } from './processors/api-key-auth.processor';

@Module({
  imports: [EndpointsModule, UsersModule],
  providers: [
    { provide: 'CallgentRealmsService', useClass: CallgentRealmsService },
    { provide: 'apiKey-authProcessor', useClass: ApiKeyAuthProcessor },
  ],
  exports: ['CallgentRealmsService'],
  controllers: [CallgentRealmsController],
})
export class CallgentRealmsModule {}
