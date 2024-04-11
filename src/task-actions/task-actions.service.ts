import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EndpointType, PrismaClient } from '@prisma/client';
import { AgentsService } from '../agents/agents.service';
import { BotletMethodsService } from '../botlet-methods/botlet-methods.service';
import { BotletMethodDto } from '../botlet-methods/dto/botlet-method.dto';
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
    private readonly botletMethodsService: BotletMethodsService,
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
    action?: string;
    callback?: string;
  }) {
    // init task action
    const { taskAction, botlets, endpoint, adaptor } =
      await this._$createTaskAction(args);

    // FIXME merge system botlets, e.g., system event register, timer, cmd entry creation

    // load botlets methods
    const botletMethods = await this._loadBotletMethods(botlets, taskAction);

    // generate pseudo-command, and upserted vars stack
    const script = await this.agentsService.genScript(
      botletMethods,
      taskAction,
    );

    // create a temp server endpoint to execute the cmd

    // entering regular instructions execution
    // this.commandExecutor.cmd(cmd, stateCtx);

    // return this._invocationFlow({ endpoint, adaptor, req }, botletUuid, action);
  }

  /**
   * @returns { 'botlet_name': [methods] }
   */
  protected async _loadBotletMethods(
    botlets: BotletDto[],
    taskAction: TaskActionDto,
  ) {
    // 1. summary to methods
    const botletMethods: { [uuid: string]: BotletMethodDto[] } = {};
    const sumBots = [];
    const bots2Load = {};
    for (const botlet of botlets) {
      if (botlet.summary) sumBots.push(botlet);
      else bots2Load[botlet.uuid] = botlet;
    }
    if (!sumBots?.length) {
      // LLM to determine related methods
    }

    // 2. load methods
    const bs = Object.keys(bots2Load);
    if (bs.length) {
      const ms = await this.botletMethodsService.findMany({
        where: { botletUuid: { in: bs } },
      });
      for (const m of ms) {
        let l = botletMethods[bots2Load[m.botletUuid].name];
        l || (l = botletMethods[bots2Load[m.botletUuid].name] = []);
        l.push(m);
      }
    }
    return botletMethods;
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
    action?: string;
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
    };
    // TODO: some action needn't persist, e.g. (action && !taskId)
    const taskAction = await prisma.taskAction.create({ data });

    return {
      taskAction,
      botlets,
      endpoint: reqEndpoint,
      adaptor: reqAdaptor,
    };
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
  //     const actions = await prisma.botletMethod.findMany({ where, take });
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

  //   protected async _routing(req: RequestPack, actions: BotletMethodDto[]) {
  //     return this.agentsService.routeAction(actions, req);
  //   }

  /** call out to server */
  /** invoke with callback */
  //   @Transactional()
  //   async callout(action: BotletMethodDto, req: RequestPack) {
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
