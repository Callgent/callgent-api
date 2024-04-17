import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EndpointType, PrismaClient } from '@prisma/client';
import { AgentsService } from '../agents/agents.service';
import { BotletFunctionsService } from '../botlet-functions/botlet-functions.service';
import { BotletFunctionDto } from '../botlet-functions/dto/botlet-function.dto';
import { BotletsService } from '../botlets/botlets.service';
import { BotletDto } from '../botlets/dto/botlet.dto';
import { EndpointsService } from '../endpoints/endpoints.service';
import { Utils } from '../infra/libs/utils';
import { PrismaTenancyService } from '../infra/repo/tenancy/prisma-tenancy.service';
import { TasksService } from '../tasks/tasks.service';
import { TaskActionDto } from './dto/task-action.dto';

/**
 * A task action belongs to a task. Triggered by an external user or system,
 * to one or more botlets.
 */
@Injectable()
export class TaskActionsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly botletsService: BotletsService,
    private readonly endpointsService: EndpointsService,
    private readonly BotletFunctionsService: BotletFunctionsService,
    private readonly tasksService: TasksService,
    private readonly agentsService: AgentsService,
    private readonly tenancyService: PrismaTenancyService,
  ) {}

  /**
   * external client call in to a group of botlets.
   * @param action ignored if multiple botlets
   */
  @Transactional()
  async $execute(args: {
    owner?: string;
    caller: string;
    taskId?: string;
    reqAdaptorKey: string;
    rawReq: object;
    botletUuids: string[];
    reqEndpointUuid?: string;
    reqFunction?: string;
    callback?: string;
  }) {
    if (args.botletUuids.length > 1) args.reqFunction = undefined;
    // init task action
    const { taskAction, botlets, reqEndpoint, reqAdaptor } =
      await this._$createTaskAction(args);

    // sync respond in time limit
    let raceWinner = -1;

    const respPromise = this._execute(botlets, taskAction).then((resp) => {
      if (raceWinner < 0) raceWinner = 0;
      // load task stage to respond
      // if stage done, callback
      return {
        data: resp,
        meta: { actionId: taskAction.id },
      };
    });

    return Promise.race([
      respPromise,
      new Promise((resolve) =>
        setTimeout(
          () => {
            if (raceWinner < 0) raceWinner = 1;
            // load task stage to respond
            resolve({ meta: { actionId: taskAction.id } });
          },
          2000, // FIXME, read from cep/request
        ),
      ),
    ]);
  }
  protected async _execute(botlets: BotletDto[], taskAction: TaskActionDto) {
    // FIXME merge system botlets, e.g., system event register, timer, cmd entry creation

    // load botlets functions
    const botletFunctions = await this._loadBotletFunctions(
      botlets,
      taskAction,
    );

    // single invocation, no vars, flow controls, and functions
    if (botlets.length === 1)
      return this._invoke(taskAction, botlets, botletFunctions);

    // load task context vars
    const taskVars = {};

    // may get sync response
    return this._interpret(taskAction, botlets, botletFunctions, taskVars);
  }

  /**
   * a single function invocation. simple with no vars/flow controls/functions.
   * system botlets are involved: collection functions, timer, etc
   */
  protected async _invoke(
    taskAction: TaskActionDto,
    botlets: BotletDto[],
    BotletFunctions: { [name: string]: BotletFunctionDto[] },
  ) {
    throw new Error('Method not implemented.');
  }

  protected async _interpret(
    taskAction: TaskActionDto,
    botlets: BotletDto[],
    BotletFunctions: { [name: string]: BotletFunctionDto[] },
    taskVars: { [name: string]: any },
  ) {
    let resp,
      reqVars = {};
    // interpret request, execute step by step
    for (;;) {
      const { func, mapping, progressive, vars } = this._routing(
        BotletFunctions,
        taskAction,
        resp,
        { ...taskVars, ...reqVars },
      );
      if (!func) break;

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
    BotletFunctions: { [name: string]: BotletFunctionDto[] },
    taskAction: TaskActionDto,
    resp: any,
    vars: { [name: string]: any },
  ) {
    const botNames = Object.keys(BotletFunctions);
    if (botNames.length == 1 && BotletFunctions[botNames[0]].length == 1)
      return BotletFunctions[botNames[0]];

    // 根据req请求，在给定的方法集中，匹配需要用到的方法子集
    // 可能用到多个，
    throw new Error('Method not implemented.');
  }

  /**
   * @returns { 'botlet_name': [functions] }
   */
  protected async _loadBotletFunctions(
    botlets: BotletDto[],
    taskAction: TaskActionDto,
  ) {
    const BotletFunctions: { [name: string]: BotletFunctionDto[] } = {};

    if (taskAction.func) {
      const ms = await this.BotletFunctionsService.findMany({
        where: {
          AND: [
            { botletUuid: { in: botlets.map((b) => b.uuid) } },
            { name: taskAction.func },
          ],
        },
      });
      if (ms?.length)
        return { [botlets.find((b) => b.uuid === ms[0].botletUuid).name]: ms };
    }
    // 1. summary to functions
    const sumBots = [];
    const bots2Load = {};
    for (const botlet of botlets) {
      if (botlet.summary) sumBots.push(botlet);
      else bots2Load[botlet.uuid] = botlet;
    }

    // 2. load functions
    const bs = Object.keys(bots2Load);
    if (bs.length) {
      const ms = await this.BotletFunctionsService.findMany({
        where: { botletUuid: { in: bs } },
      });
      for (const m of ms) {
        let l = BotletFunctions[bots2Load[m.botletUuid].name];
        l || (l = BotletFunctions[bots2Load[m.botletUuid].name] = []);
        l.push(m);
      }
    }

    // 3. load functions by summary
    if (!sumBots?.length) {
      // LLM to determine related functions
    }

    return BotletFunctions;
  }

  @Transactional()
  protected async _$createTaskAction(args: {
    owner?: string;
    caller: string;
    taskId?: string;
    reqAdaptorKey: string;
    rawReq: object;
    botletUuids: string[];
    reqEndpointUuid?: string;
    reqFunction?: string;
    callback?: string;
  }) {
    if (!args.botletUuids?.length)
      throw new BadRequestException('botletUuids must be specified');

    // client adaptor
    const reqAdaptor = this.endpointsService.getAdaptor(
      args.reqAdaptorKey,
      EndpointType.CLIENT,
    );
    if (!reqAdaptor)
      throw new NotFoundException(
        `Client endpoint adaptor not found, key=${args.reqAdaptorKey}`,
      );

    // tenantId
    const prisma = this.txHost.tx as PrismaClient;
    await this.tenancyService.bypassTenancy(prisma);

    const reqEndpoint = args.reqEndpointUuid
      ? await this.endpointsService.findOne(args.reqEndpointUuid)
      : await this.endpointsService.findFirstByType(
          args.botletUuids,
          args.reqAdaptorKey,
          EndpointType.CLIENT,
        );
    if (
      !reqEndpoint ||
      reqEndpoint.type != EndpointType.CLIENT ||
      reqEndpoint.adaptorKey != args.reqAdaptorKey ||
      !args.botletUuids.includes(reqEndpoint.botletUuid)
    )
      throw new NotFoundException(
        `Client endpoint not found, uuid=${args.reqEndpointUuid}`,
      );

    this.tenancyService.setTenantId(reqEndpoint.tenantId);
    await this.tenancyService.bypassTenancy(prisma, false);

    // load botlets
    const botlets = await this.botletsService.findMany(args.botletUuids, {
      uuid: true,
      name: true,
      summary: true,
    });
    // TODO add system botlets

    // new task
    const task = args.taskId
      ? await this.tasksService.findOne(args.taskId, { uuid: true })
      : await this.tasksService.create({}, args.caller, { uuid: true });
    if (!task)
      throw new NotFoundException('Task not found, uuid=' + args.taskId);

    // get callback
    args.callback = await reqAdaptor.getCallback(
      args.callback,
      args.rawReq,
      reqEndpoint,
    );

    const req = reqAdaptor.toJson(args.rawReq, true, reqEndpoint);

    // action owner default to caller's botlet
    if (!args.owner && args.caller) {
    }

    const data = {
      req,
      taskUuid: task.uuid,
      owner: args.owner,
      uuid: Utils.uuid(),
      cAdaptor: args.reqAdaptorKey,
      cepUuid: reqEndpoint?.uuid,
      callback: args.callback,
      createdBy: args.caller,
      reqFunction: args.reqFunction,
      returns: false, // FIXME
    };
    // TODO: some action needn't persist, e.g. (action && !taskId)
    const taskAction = await prisma.taskAction.create({ data });

    return { taskAction, botlets, reqEndpoint, reqAdaptor };
  }

  /** invocation flow, and lifecycle events */
  //   protected async _invocationFlow(
  //     req: RequestPack,
  //     botletUuid: string,
  //     actionName?: string,
  //   ) {
  //     const prisma = this.txHost.tx as PrismaClient;

  //     // specific/AI routing from req, get action params/code, TODO: [and specific mapping]
  //     const where = actionName
  //       ? { AND: [{ name: actionName }, { botletUuid }] }
  //       : { botletUuid };
  //     const take = actionName ? 1 : undefined;
  //     const actions = await prisma.botletFunction.findMany({ where, take });
  //     const action = actionName
  //       ? actions.find((a) => a.name == actionName)
  //       : await this._routing(req, actions);
  //     if (!action)
  //       throw new BadRequestException(
  //         'Action entry not found on botlet: ' + botletUuid,
  //       );

  //     // may reply ack to client directly, async result
  //     const resp = await this.callout(action, req);

  //     // task ctx io
  //     // response to client or next cmd
  //   }

  //   protected async _routing(req: RequestPack, actions: BotletFunctionDto[]) {
  //     return this.agentsService.routeAction(actions, req);
  //   }

  /** call out to server */
  /** invoke with callback */
  //   @Transactional()
  //   async callout(action: BotletFunctionDto, req: RequestPack) {
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
