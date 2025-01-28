import { Inject, Injectable, Logger } from '@nestjs/common';
import { ScriptAgentService } from '../agents/script-agent.service';
import { PendingOrResponse } from '../entries/adaptors/entry-adaptor.base';
import { ClientRequestEvent } from '../entries/events/client-request.event';
import { InvokeService } from './invoke.service';

/** agent to generate macro script for task */
@Injectable()
export class ScriptRunnerService {
  private readonly logger = new Logger(ScriptRunnerService.name);
  constructor(
    @Inject('ScriptAgentService')
    private readonly scriptAgentService: ScriptAgentService,
    private readonly invokeService: InvokeService,
  ) {}

  /**
   * run and fix script until success
   */
  async runAndFix(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const result = await this.invokeService.invokeSEPs(reqEvent);
    return this._handleResult(result, reqEvent);
  }

  async runAndFixCallback(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const result = await this.invokeService.invokeSEPsCallback(reqEvent);
    return this._handleResult(result, reqEvent);
  }

  private async _handleResult(
    result: PendingOrResponse | { statusCode: number; message: string },
    reqEvent: ClientRequestEvent,
  ) {
    const { context } = reqEvent;
    if (result.statusCode == 2)
      return { data: reqEvent, resumeFunName: 'runAndFixCallback' };

    if ('data' in result) {
      context.resp = result.data;
      return; // success, clear script
    }

    // retry fix script error
    const retry = (context.invocations.retry as unknown as number) || 0;
    if (retry > 3)
      throw new Error('Task script failed(3x), error: ' + result.message);

    const fixed = await this._fixScriptError(result, reqEvent);
    if (!fixed)
      throw new Error('Failed to fix task script, error: ' + result.message);

    // retry execution
    context.invocations = { retry: (1 + retry) as any }; // clear previous invocations
    return this.runAndFix(reqEvent);
  }

  /**
   * fix main.ts/package.json based on:
   * - error msg
   * - file tree
   * - log file
   * - user feedback: as normal request event
   */
  private async _fixScriptError(
    result: { statusCode?: number; message?: string },
    reqEvent: ClientRequestEvent,
  ) {
    // try fix script
    const { message } = result;
    await this.scriptAgentService.fixScriptError(message, reqEvent);
    return false;
  }
}
