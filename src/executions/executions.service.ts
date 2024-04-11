import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EndpointType, PrismaClient } from '@prisma/client';
import { AgentsService } from '../agents/agents.service';
import { BotletMethodDto } from './dto/botlet-method.dto';
import { BotletsService } from '../botlets/botlets.service';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';
import { EndpointsService } from '../endpoints/endpoints.service';
import { JwtPayload } from '../infra/auth/jwt/jwt.service';
import { CommandExecutor } from './command.executor';

/**
 * An execution belongs to a task. Triggered by an external user or system,
 * to one or more botlets.
 */
@Injectable()
export class ExecutionsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly botletsService: BotletsService,
    private readonly endpointsService: EndpointsService,
    private readonly agentsService: AgentsService,
    private readonly commandExecutor: CommandExecutor,
  ) {}

  /**
   * external client call in to a group of botlets.
   * @param action ignored if multiple botlets
   */
  @Transactional()
  async execute(
    botletUuids: string[],
    rawReq: object,
    reqAdaptorKey: string,
    ctx: { taskId?: string; caller?: JwtPayload; callback?: string } = {},
    reqEndpointUuid?: string,
    action?: string,
  ) {
    if (!botletUuids?.length)
      throw new BadRequestException('botletUuids must be specified');

    // client adaptor
    const reqAdaptor = this.endpointsService.getAdaptor(
      reqAdaptorKey,
      EndpointType.CLIENT,
    );
    if (!reqAdaptor)
      throw new NotFoundException(
        `Client endpoint adaptor not found, key=${reqAdaptorKey}`,
      );

    let reqEndpoint: EndpointDto;
    if (reqEndpointUuid) {
      reqEndpoint = await this.endpointsService.findOne(reqEndpointUuid);
      if (
        !reqEndpoint ||
        reqEndpoint.type != EndpointType.CLIENT ||
        reqEndpoint.adaptorKey != reqAdaptorKey ||
        !botletUuids.includes(reqEndpoint.botletUuid)
      )
        throw new NotFoundException(
          `Endpoint not found, uuid=${reqEndpointUuid}`,
        );
    }

    // load botlets
    const prisma = this.txHost.tx as PrismaClient;
    const botlets = await prisma.botlet.findMany({
      where: { uuid: { in: botletUuids } },
      select: { uuid: true, name: true, summary: true },
    });
    if (botlets.length != botletUuids.length)
      throw new NotFoundException(
        `Botlet not found, uuid=${botletUuids
          .filter((x) => !botlets.find((y) => y.uuid == x))
          .join(', ')}`,
      );

    const req = reqAdaptor.toJson(rawReq, true, reqEndpoint);

    // FIXME when to persist req/resp into task
    // FIXME task ctx, and vars stack
    const stateCtx = { stack: [ctx] };

    // FIXME merge system botlets, e.g., system event register, cmd entry creation

    // generate pseudo-command, and upserted vars stack
    const cmd = await this.agentsService.genPseudoCmd(stateCtx, botlets, req);

    // create a temp server endpoint to execute the cmd

    // entering regular instructions execution
    this.commandExecutor.cmd(cmd, stateCtx);

    return this._invocationFlow(
      { endpoint: reqEndpoint, adaptor: reqAdaptor, req: rawReq },
      botletUuid,
      action,
    );
  }

  /** invocation flow, and lifecycle events */
  protected async _invocationFlow(
    req: RequestPack,
    botletUuid: string,
    actionName?: string,
  ) {
    const prisma = this.txHost.tx as PrismaClient;

    // specific/AI routing from req, get action params/code, TODO: [and specific mapping]
    const where = actionName
      ? { AND: [{ name: actionName }, { botletUuid }] }
      : { botletUuid };
    const take = actionName ? 1 : undefined;
    const actions = await prisma.botletMethod.findMany({ where, take });
    const action = actionName
      ? actions.find((a) => a.name == actionName)
      : await this._routing(req, actions);
    if (!action)
      throw new BadRequestException(
        'Action entry not found on botlet: ' + botletUuid,
      );

    // may reply ack to client directly, async result
    const resp = await this.callout(action, req);

    // task ctx io
    // response to client or next cmd
  }

  protected async _routing(req: RequestPack, actions: BotletMethodDto[]) {
    return this.agentsService.routeAction(actions, req);
  }

  /** call out to server */
  /** invoke with callback */
  @Transactional()
  async callout(action: BotletMethodDto, req: RequestPack) {
    // get server endpoint(sep), and sAdaptor
    const sEndpoint = await this.findOne(action.endpointUuid);
    if (!sEndpoint)
      throw new NotFoundException(
        `Endpoint not found, uuid=${action.endpointUuid}`,
      );
    const sAdaptor = this.getAdaptor(sEndpoint.adaptorKey, sEndpoint.type);
    if (!sAdaptor)
      throw new NotFoundException(
        `Endpoint#${action.endpointUuid} adaptor not found, adaptorKey=${sEndpoint.adaptorKey}`,
      );

    //// async/sync execute action command, given action params/code/req/[specific mapping], with cb
    // do specific/AI mapping from task ctx
    const params = await this.agentsService.mapParams(action.content, req);
    // [async preparing]
    // invoking adaptor
    const resp = await sAdaptor.invoke(params);
    // response handling
    return resp;
    //// end exec.
  }
}
