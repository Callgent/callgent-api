import { Module } from '@nestjs/common';
import { CachedModule } from '../cached/cached.module';
import { CallgentRealmsModule } from '../callgent-realms/callgent-realms.module';
import { EntriesModule } from '../entries/entries.module';
import { InvokeAuthProcessor } from './chain/invoke-auth.processor';
import { InvokeCacheProcessor } from './chain/invoke-cache.processor';
import { InvokeCachedProcessor } from './chain/invoke-cached.processor';
import { InvokeCallbackProcessor } from './chain/invoke-callback.processor';
import {
  INVOKE_CHAIN_LIST,
  InvokeChainService,
} from './invoke-chain.service';
import { InvokePostprocessProcessor } from './chain/invoke-postprocess.processor';
import { InvokeSepProcessor } from './chain/invoke-sep.processor';
import { InvokeProcessor } from './chain/invoke.processor';
import { InvokeService } from './invoke.service';

@Module({
  imports: [CallgentRealmsModule, CachedModule, EntriesModule],
  providers: [
    { provide: 'InvokeService', useClass: InvokeService },
    InvokeChainService,
    {
      provide: INVOKE_CHAIN_LIST,
      useFactory: (...instances: InvokeProcessor[]) => instances,
      inject: [
        InvokeAuthProcessor,
        InvokeCachedProcessor,
        InvokeSepProcessor,
        InvokePostprocessProcessor,
        InvokeCacheProcessor,
        InvokePostprocessProcessor,
        InvokeCallbackProcessor,
      ],
    },
    InvokeAuthProcessor,
    InvokeCachedProcessor,
    InvokeSepProcessor,
    InvokePostprocessProcessor,
    InvokeCacheProcessor,
    InvokeCallbackProcessor,
  ],
})
export class InvokeModule {}
