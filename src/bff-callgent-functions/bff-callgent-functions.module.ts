import { Module } from '@nestjs/common';
import { BffCallgentFunctionsController } from './bff-callgent-functions.controller';
import { CallgentFunctionsModule } from '../callgent-functions/callgent-functions.module';

@Module({
  imports: [CallgentFunctionsModule],
  controllers: [BffCallgentFunctionsController],
})
export class BffCallgentFunctionsModule {}
