import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
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
  //     ? await this.tasksService.findOne(taskId, { id: true })
  //     : await this.tasksService.create({}, caller, { id: true });
  //   if (!task) throw new NotFoundException('Task not found, id=' + taskId);

  //   const data = {
  //     id: Utils.id(),
  //     req,
  //     taskId: task.id,
  //     progressive,
  //     cAdaptor: reqEvent.dataType,
  //     cepId: reqEvent.srcId,
  //     callback,
  //     createdBy: caller,
  //     funName,
  //     returns: false, // FIXME
  //   };
  //   // TODO: some action needn't persist, e.g. (action && !taskId)
  //   const prisma = this.txHost.tx as PrismaClient;
  //   await prisma.taskAction.create({ data });
  //   reqEvent.data.taskId = task.id;
  //   reqEvent.processed.taskActionId = data.id;
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

  protected async _execute(
    callgents: CallgentDto[],
    taskAction: TaskActionDto,
  ) {
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
    throw new NotImplementedException('Method not implemented.');
  }
}
