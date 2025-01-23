import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import fs from 'fs';
import { ClsService } from 'nestjs-cls';
import path from 'path';
import { PendingOrResponse } from '../entries/adaptors/entry-adaptor.base';
import { ClientRequestEvent } from '../entries/events/client-request.event';
import { ServiceResponse } from '../event-listeners/event-object';
import { FilesService } from '../files/files.service';
import { InvokeSepService } from './invoke-sep.service';
import { InvokeSubprocess } from './invoke.subprocess';

@Injectable()
export class InvokeService {
  private static readonly CTX_KEY_INVOKE_ID = Symbol('invokeId');

  constructor(
    private readonly invokeSepService: InvokeSepService,
    private readonly filesService: FilesService,
    private readonly invokeSubprocess: InvokeSubprocess,
    private readonly cls: ClsService,
  ) {}

  /**
   * call script in subprocess,
   * which may send `invokeService` request,
   * on sep pending response, freeze subprocess by criu, until sep callback: resume subprocess by criu
   * send response to subprocess, script goes on
   */
  @Transactional()
  async invokeSEPs(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const {
      epName,
      map2Endpoints: { requestArgs },
    } = reqEvent.context;

    // direct sep invoke and returns, needn't subprocess
    if (epName) {
      const r = await this._invokeSEP(epName, requestArgs, reqEvent);
      if (r?.statusCode == 2)
        return { data: reqEvent, resumeFunName: 'invokeSEPsCallback' };
      reqEvent.context.resp = r.data;
      return;
    }

    // start subprocess to invoke
    return this._spawnOrRestoreSubprocess(reqEvent);
  }

  @Transactional()
  async invokeSEPsCallback(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const invokeId = this.getInvokeId();
    if (typeof invokeId == 'undefined')
      throw new Error('invokeId is required for invocation callback');
    const invocation = reqEvent.context.invocations[invokeId];
    if (!invocation)
      throw new Error('invocation not found for invokeId ' + invokeId);

    const response = await this._invokeSEP(null, null, reqEvent, invokeId);
    // if pending, throw error
    if (response?.statusCode == 2)
      throw new Error(
        'Callback response should not be pending, invokeId=' + invokeId,
      );

    if (reqEvent.context.epName) {
      reqEvent.context.resp = response.data;
      return;
    }

    // restore subprocess and send callback response
    return this._spawnOrRestoreSubprocess(reqEvent, response.data, invokeId);
  }

  /**
   * invoke a service endpoint through processor chain: auth/cache/..
   * @param reqEvent with request context
   * @returns endpoint response, or pending status
   * @throws chain error
   */
  protected async _invokeSEP(
    epName: string,
    args: any,
    reqEvent: ClientRequestEvent,
    invokeId = '',
  ) {
    // init invoke chain ctx
    let invocation = reqEvent.context.invocations[invokeId];
    if (!invocation)
      reqEvent.context.invocations[invokeId] = invocation = {
        invokeId,
        epName,
        args,
      };

    let resp: PendingOrResponse;
    this.setInvokeId(invokeId);
    try {
      resp = await this.invokeSepService.chain(invocation, reqEvent);
      return resp;
    } finally {
      this._removeInvokeId();
      // if not pending, invocation done
      if (resp?.statusCode != 2) delete reqEvent.context.invocations[invokeId];
      reqEvent.message = resp?.message;
    }
  }

  /** set invokeId into cls context */
  public setInvokeId(invokeId: string) {
    this.cls.set(InvokeService.CTX_KEY_INVOKE_ID, invokeId);
  }

  /** get invokeId from cls context */
  public getInvokeId() {
    return this.cls.get(InvokeService.CTX_KEY_INVOKE_ID) as string;
  }

  protected _removeInvokeId() {
    this.cls.set(InvokeService.CTX_KEY_INVOKE_ID, undefined);
  }

  parseInvokeKey(invokeKey: string) {
    const idx = invokeKey.indexOf('-');
    return {
      invokeId: invokeKey.substring(0, idx),
      eventId: invokeKey.substring(idx + 1),
    };
  }

  composeInvokeKey(invokeId: string, eventId: string) {
    return `${invokeId}-${eventId}`;
  }

  setCallbackResponse(
    invokeId: string,
    callbackResponse: any,
    reqEvent: ClientRequestEvent,
  ) {
    const invocation = reqEvent.context.invocations[invokeId];
    if (!invocation)
      throw new Error('invocation not found for invokeId ' + invokeId);
    invocation.response = callbackResponse;
    this.setInvokeId(invokeId);
  }

  /**
   * @param response restore subprocess, send callback response to subprocess, script goes on
   */
  protected async _spawnOrRestoreSubprocess(
    reqEvent: ClientRequestEvent,
    response?: ServiceResponse,
    invokeId = '',
  ) {
    const cwd = reqEvent.getTaskCwd(this.filesService.UPLOAD_BASE_DIR);
    const cmdPrefix = reqEvent.taskId.substring(reqEvent.taskId.length - 3);
    const child = await this.invokeSubprocess.spawnOrRestore(
      'npx',
      ['tsx', 'index.ts', cmdPrefix],
      { cwd },
    );

    // create named pipe to communicate with subprocess
    const pipePath = path.join(cwd, 'pipe.socket');
    let frozenKilled = false;
    // FIXME: concurrent invoke, if pending wait for all responses before freeze subprocess
    const server = this.invokeSubprocess.createNamedPipe(pipePath, {
      onConnect: async (socket) => {
        if (response)
          socket.write(`${cmdPrefix}-${invokeId}-${JSON.stringify(response)}`);
      },
      onLine: async (data, socket) => {
        const msg = data.toString();
        const [prefix, invokeId, ...cmd] = msg.split('-');
        if (cmdPrefix != prefix) return;

        // matching command
        const { epName, args } = JSON.parse(cmd.join('-'));
        const r = await this._invokeSEP(epName, args, reqEvent, invokeId);

        //if pending response, freeze subprocess
        if (r?.statusCode == 2) {
          this.invokeSubprocess.freezeProcess(child, cwd);
          frozenKilled = true;
        } else {
          socket.write(`${cmdPrefix}-${invokeId}-${JSON.stringify(r)}`);
        }
      },
    });

    try {
      const exitCode = await this.invokeSubprocess.waitForExit(child);
      // frozen process SIGKILL, exit code is 128 + 9 is OK
      if (exitCode && (!frozenKilled || exitCode != 137))
        throw new Error('Task Subprocess exited with code ' + exitCode);
    } finally {
      server.close((err) => {
        if (err) console.error(err);
        fs.existsSync(pipePath) && fs.unlinkSync(pipePath);
      });
    }

    if (frozenKilled)
      return { data: reqEvent, resumeFunName: 'invokeSEPsCallback' };
  }
}
