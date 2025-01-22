import { Module } from '@nestjs/common';
import { CachedModule } from '../cached/cached.module';
import { CallgentRealmsModule } from '../callgent-realms/callgent-realms.module';
import { EntriesModule } from '../entries/entries.module';
import { SepAuthProcessor } from './chain/sep-auth.processor';
import { SepCacheProcessor } from './chain/sep-cache.processor';
import { SepCachedProcessor } from './chain/sep-cached.processor';
import { SepCallbackPostprocessProcessor } from './chain/sep-callback-postprocess.processor';
import { SepCallbackProcessor } from './chain/sep-callback.processor';
import { SepInvokeProcessor } from './chain/sep-invoke.processor';
import { SepPostprocessProcessor } from './chain/sep-postprocess.processor';
import { SepProcessor } from './chain/sep.processor';
import { INVOKE_CHAIN_LIST, InvokeSepService } from './invoke-sep.service';
import { InvokeService } from './invoke.service';
import { InvokeSubprocess } from './invoke.subprocess';

@Module({
  imports: [CallgentRealmsModule, CachedModule, EntriesModule],
  providers: [
    { provide: 'InvokeService', useClass: InvokeService },
    InvokeSepService,
    InvokeSubprocess,
    {
      provide: INVOKE_CHAIN_LIST,
      useFactory: (...instances: SepProcessor[]) => instances,
      inject: [
        // don't repeat
        SepAuthProcessor,
        SepCachedProcessor,
        SepInvokeProcessor,
        SepPostprocessProcessor,
        SepCacheProcessor,
        SepCallbackPostprocessProcessor,
        SepCallbackProcessor,
      ],
    },
    SepAuthProcessor,
    SepCachedProcessor,
    SepInvokeProcessor,
    SepPostprocessProcessor,
    SepCallbackPostprocessProcessor,
    SepCacheProcessor,
    SepCallbackProcessor,
  ],
  exports: ['InvokeService'],
})
export class InvokeModule {}
