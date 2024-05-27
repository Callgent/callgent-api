import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CallgentFunctionDto } from '../callgent-functions/dto/callgent-function.dto';
import { CallgentDto } from '../callgents/dto/callgent.dto';
import { ClientRequestEvent } from '../endpoints/events/client-request.event';
import { Utils } from '../infra/libs/utils';
import { TasksService } from '../tasks/tasks.service';
import { TaskActionDto } from './dto/task-action.dto';

/**
 * A task action belongs to a task. Triggered by an external user or system,
 * to one or more callgents.
 */
@Injectable()
export class TaskActionsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly tasksService: TasksService,
  ) {}

  /** create task action for client request. */
  // @Transactional()
  // async createTaskAction(reqEvent: ClientRequestEvent) {
  //   const { taskId, caller, progressive, callback, funName } = reqEvent.data;
  //   const req = (reqEvent.processed.req || reqEvent.data.req) as any;

  //   // new task
  //   const task = taskId
  //     ? await this.tasksService.findOne(taskId, { uuid: true })
  //     : await this.tasksService.create({}, caller, { uuid: true });
  //   if (!task) throw new NotFoundException('Task not found, uuid=' + taskId);

  //   const data = {
  //     uuid: Utils.uuid(),
  //     req,
  //     taskUuid: task.uuid,
  //     progressive,
  //     cAdaptor: reqEvent.dataType,
  //     cepUuid: reqEvent.srcId,
  //     callback,
  //     createdBy: caller,
  //     funName,
  //     returns: false, // FIXME
  //   };
  //   // TODO: some action needn't persist, e.g. (action && !taskId)
  //   const prisma = this.txHost.tx as PrismaClient;
  //   await prisma.taskAction.create({ data });
  //   reqEvent.data.taskId = task.uuid;
  //   reqEvent.processed.taskActionId = data.uuid;
  // }

  async __createTaskAction(e: ClientRequestEvent) {
    // init task action
    // const { taskAction, callgents, reqEndpoint, reqAdaptor } =
    // await this._$createTaskAction(e);

    // sync respond in time limit
    let raceWinner = -1;

    // const respPromise = this._execute(callgents, taskAction).then((resp) => {
    //   if (raceWinner < 0) raceWinner = 0;
    //   // load task stage to respond
    //   // if stage done, callback
    //   return {
    //     data: resp,
    //     meta: { actionId: taskAction.id },
    //   };
    // });

    // return Promise.race([
    //   respPromise,
    //   new Promise((resolve) =>
    //     setTimeout(
    //       () => {
    //         if (raceWinner < 0) raceWinner = 1;
    //         // load task stage to respond
    //         resolve({ meta: { actionId: taskAction.id } });
    //       },
    //       2000000, // FIXME, read from cep/request
    //     ),
    //   ),
    // ]);
  }

  protected async _execute(callgents: CallgentDto[], taskAction: TaskActionDto) {
    // FIXME merge system callgents, e.g., system event register, timer, cmd entry creation

    // load task context vars
    const taskVars = {};

    // may get sync response
    // return this._interpret(taskAction, callgents, callgentFunctions, taskVars);
  }

  protected async _interpret(
    taskAction: TaskActionDto,
    callgents: CallgentDto[],
    callgentFunctions: { [callgentName: string]: CallgentFunctionDto[] },
    taskVars: { [name: string]: any },
  ) {
    let resp,
      reqVars = {};
    // interpret request, execute step by step
    for (;;) {
      const { funName, mapping, progressive, vars } = await this._routing(
        callgentFunctions,
        taskAction,
        resp,
        { ...taskVars, ...reqVars },
      );
      if (!funName) break;

      if (progressive) {
        // request event owner for more req info
      }

      if (mapping) {
        //
      }
    }
    return resp;
  }

  protected async _routing(
    CallgentFunctions: { [callgentName: string]: CallgentFunctionDto[] },
    taskAction: TaskActionDto,
    resp: any,
    vars: { [name: string]: any },
  ): Promise<{ funName; mapping; progressive; vars }> {
    // const botNames = Object.keys(CallgentFunctions);
    // if (botNames.length == 1 && CallgentFunctions[botNames[0]].length == 1)
    //   return CallgentFunctions[botNames[0]];

    // 根据req请求，在给定的方法集中，匹配需要用到的方法子集
    // 可能用到多个，
    throw new Error('Method not implemented.');
  }

  /** invocation flow, and lifecycle events */
  //   protected async _invocationFlow(
  //     req: RequestPack,
  //     callgentUuid: string,
  //     actionName?: string,
  //   ) {
  //     const prisma = this.txHost.tx as PrismaClient;

  //     // specific/AI routing from req, get action params/code, TODO: [and specific mapping]
  //     const where = actionName
  //       ? { AND: [{ name: actionName }, { callgentUuid }] }
  //       : { callgentUuid };
  //     const take = actionName ? 1 : undefined;
  //     const actions = await prisma.callgentFunction.findMany({ where, take });
  //     const action = actionName
  //       ? actions.find((a) => a.name == actionName)
  //       : await this._routing(req, actions);
  //     if (!action)
  //       throw new BadRequestException(
  //         'Action entry not found on callgent: ' + callgentUuid,
  //       );

  //     // may reply ack to client directly, async result
  //     const resp = await this.callout(action, req);

  //     // task ctx io
  //     // response to client or next cmd
  //   }

  //   protected async _routing(req: RequestPack, actions: CallgentFunctionDto[]) {
  //     return this.agentsService.routeAction(actions, req);
  //   }

  /** call out to server */
  /** invoke with callback */
  //   @Transactional()
  //   async callout(action: CallgentFunctionDto, req: RequestPack) {
  //     // get server endpoint(sep), and sAdaptor
  //     const sEndpoint = await this.findOne(action.endpointUuid);
  //     if (!sEndpoint)
  //       throw new NotFoundException(
  //         `Endpoint not found, uuid=${action.endpointUuid}`,
  //       );
  //     const sAdaptor = this.getAdaptor(sEndpoint.adaptorKey, sEndpoint.type);
  //     if (!sAdaptor)
  //       throw new NotFoundException(
  //         `Endpoint#${action.endpointUuid} adaptor not found, adaptorKey=${sEndpoint.adaptorKey}`,
  //       );

  //     //// async/sync execute action command, given action params/code/req/[specific mapping], with cb
  //     // do specific/AI mapping from task ctx
  //     const params = await this.agentsService.mapParams(action.content, req);
  //     // [async preparing]
  //     // invoking adaptor
  //     const resp = await sAdaptor.invoke(params);
  //     // response handling
  //     return resp;
  //     //// end exec.
  //   }
}
