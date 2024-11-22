import { Module } from '@nestjs/common';
import { CachedModule } from '../cached/cached.module';
import { CallgentRealmsModule } from '../callgent-realms/callgent-realms.module';
import { EntriesModule } from '../entries/entries.module';
import { SepAuthProcessor } from './chain/sep-auth.processor';
import { SepCacheProcessor } from './chain/sep-cache.processor';
import { SepCachedProcessor } from './chain/sep-cached.processor';
import { SepCallbackProcessor } from './chain/sep-callback.processor';
import {
  INVOKE_CHAIN_LIST,
  InvokeSepService,
} from './invoke-sep.service';
import { SepPostprocessProcessor } from './chain/sep-postprocess.processor';
import { SepInvokeProcessor } from './chain/sep-invoke.processor';
import { SepProcessor } from './chain/sep.processor';
import { InvokeService } from './invoke.service';

@Module({
  imports: [CallgentRealmsModule, CachedModule, EntriesModule],
  providers: [
    { provide: 'InvokeService', useClass: InvokeService },
    InvokeSepService,
    {
      provide: INVOKE_CHAIN_LIST,
      useFactory: (...instances: SepProcessor[]) => instances,
      inject: [
        SepAuthProcessor,
        SepCachedProcessor,
        SepInvokeProcessor,
        SepPostprocessProcessor,
        SepCacheProcessor,
        SepPostprocessProcessor,
        SepCallbackProcessor,
      ],
    },
    SepAuthProcessor,
    SepCachedProcessor,
    SepInvokeProcessor,
    SepPostprocessProcessor,
    SepCacheProcessor,
    SepCallbackProcessor,
  ],
})
export class InvokeModule {}
