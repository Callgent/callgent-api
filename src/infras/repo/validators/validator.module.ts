import { Global, Module } from '@nestjs/common';
import { EntityIdExistsRule } from './entity-exists.validator';

@Global()
@Module({
  providers: [EntityIdExistsRule],
})
export class ValidatorModule {}
