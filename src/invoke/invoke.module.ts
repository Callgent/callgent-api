import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { CachedModule } from '../cached/cached.module';
import { CallgentRealmsModule } from '../callgent-realms/callgent-realms.module';
import { EntriesModule } from '../entries/entries.module';
import { SepAuthProcessor } from './chain/sep-auth.processor';
import { SepCacheProcessor } from './chain/sep-cache.processor';
import { SepCachedProcessor } from './chain/sep-cached.processor';
import { SepCallbackPostprocessProcessor } from './chain/sep-callback-postprocess.processor';
import { SepCallbackCacheProcessor } from './chain/sep-callback.processor';
import { SepInvokeProcessor } from './chain/sep-invoke.processor';
import { SepPostprocessProcessor } from './chain/sep-postprocess.processor';
import { SepProcessor } from './chain/sep.processor';
import { INVOKE_CHAIN_LIST, InvokeSepService } from './invoke-sep.service';
import { InvokeService } from './invoke.service';
import { InvokeSubprocess } from './invoke.subprocess';
import { PostAuthListener } from './listeners/post-auth.listener';
import { PostResponseListener } from './listeners/post-response.listener';
import { ScriptRunnerService } from './script-runner.service';

@Module({
  imports: [CallgentRealmsModule, CachedModule, EntriesModule, BillingModule],
  providers: [
    { provide: 'ScriptRunnerAgent', useClass: ScriptRunnerService },
    InvokeService,
    InvokeSepService,
    InvokeSubprocess,
    {
      provide: INVOKE_CHAIN_LIST,
      useFactory: (...instances: SepProcessor[]) => instances,
      inject: [
        // don't repeat the same instance twice
        SepAuthProcessor,
        SepCachedProcessor,
        SepInvokeProcessor,
        SepPostprocessProcessor,
        SepCacheProcessor,
        SepCallbackPostprocessProcessor,
        SepCallbackCacheProcessor,
      ],
    },
    SepAuthProcessor,
    SepCachedProcessor,
    SepInvokeProcessor,
    SepPostprocessProcessor,
    SepCallbackPostprocessProcessor,
    SepCacheProcessor,
    SepCallbackCacheProcessor,
    PostAuthListener,
    PostResponseListener,
  ],
  exports: ['ScriptRunnerAgent', InvokeService],
})
export class InvokeModule {}
