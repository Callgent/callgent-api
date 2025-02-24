import { Global, Module } from '@nestjs/common';
import { LocalAuthStrategy } from './local-auth.strategy';

@Global()
@Module({
  providers: [LocalAuthStrategy],
})
export class LocalAuthModule {}
