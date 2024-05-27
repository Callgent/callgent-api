import { Module } from '@nestjs/common';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { CallgentFunctionsController } from './callgent-functions.controller';
import { CallgentFunctionsService } from './callgent-functions.service';

@Module({
  imports: [EndpointsModule],
  providers: [
    { provide: 'CallgentFunctionsService', useClass: CallgentFunctionsService },
  ],
  controllers: [CallgentFunctionsController],
  exports: ['CallgentFunctionsService'],
})
export class CallgentFunctionsModule {}
