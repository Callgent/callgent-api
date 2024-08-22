import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EndpointType, PrismaClient } from '@prisma/client';
import { CallgentsService } from '../callgents/callgents.service';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';
import { EndpointsService } from '../endpoints/endpoints.service';
import { JwtPayload } from '../infra/auth/jwt/jwt.service';
import { CommandExecutor } from './command.executor';

/**
 * An execution belongs to a task. Triggered by an external user or system,
 * to one or more callgents.
 */
@Injectable()
export class ExecutionsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly callgentsService: CallgentsService,
    @Inject('EndpointsService')
    private readonly endpointsService: EndpointsService,
    private readonly commandExecutor: CommandExecutor,
  ) {}

  /**
   * external client call in to a group of callgents.
   * @param action ignored if multiple callgents
   */
  @Transactional()
  async execute(
    callgentIds: string[],
    rawReq: object,
    reqAdaptorKey: string,
    ctx: { taskId?: string; caller?: JwtPayload; callback?: string } = {},
    reqEndpointId?: string,
    action?: string,
  ) {
    if (!callgentIds?.length)
      throw new BadRequestException('callgentIds must be specified');

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
    if (reqEndpointId) {
      reqEndpoint = await this.endpointsService.findOne(reqEndpointId);
      if (
        !reqEndpoint ||
        reqEndpoint.type != EndpointType.CLIENT ||
        reqEndpoint.adaptorKey != reqAdaptorKey ||
        !callgentIds.includes(reqEndpoint.callgentId)
      )
        throw new NotFoundException(`Endpoint not found, id=${reqEndpointId}`);
    }

    // load callgents
    const prisma = this.txHost.tx as PrismaClient;
    const callgents = await prisma.callgent.findMany({
      where: { id: { in: callgentIds } },
      select: { id: true, name: true, summary: true },
    });
    if (callgents.length != callgentIds.length)
      throw new NotFoundException(
        `Callgent not found, id=${callgentIds
          .filter((x) => !callgents.find((y) => y.id == x))
          .join(', ')}`,
      );

    // const req = reqAdaptor.toJson(rawReq, true, reqEndpoint);

    // FIXME when to persist req/resp into task
    // FIXME task ctx, and vars stack
    const stateCtx = { stack: [ctx] };

    // FIXME merge system callgents, e.g., system event register, cmd entry creation

    // generate pseudo-command, and upserted vars stack
    // const cmd = await this.agentsService.genPseudoCmd(callgents, stateCtx as any);

    // create a temp server endpoint to execute the cmd

    // entering regular instructions execution
    // this.commandExecutor.cmd(cmd, stateCtx);

    // return this._invocationFlow(
    //   { endpoint: reqEndpoint, adaptor: reqAdaptor, req: rawReq },
    //   callgentIds[0],
    //   action,
    // );
  }

  /** invocation flow, and lifecycle events */
  // protected async _invocationFlow(
  //   req: any,
  //   callgentId: string,
  //   actionName?: string,
  // ) {
  //   const prisma = this.txHost.tx as PrismaClient;

  //   // specific/AI routing from req, get action params/code, TODO: [and specific mapping]
  //   const where = actionName
  //     ? { AND: [{ name: actionName }, { callgentId }] }
  //     : { callgentId };
  //   const take = actionName ? 1 : undefined;
  //   const actions = await prisma.callgentFunction.findMany({ where, take });
  //   const action = actionName
  //     ? actions.find((a) => a.name == actionName)
  //     : await this._routing(req, actions);
  //   if (!action)
  //     throw new BadRequestException(
  //       'Action entry not found on callgent: ' + callgentId,
  //     );

  //   // may reply ack to client directly, async result
  //   const resp = await this.callout(action, req);

  //   // task ctx io
  //   // response to client or next cmd
  // }

  // protected async _routing(req: any, actions: CallgentFunctionDto[]) {
  //   return this.agentsService.routeAction(actions, req);
  // }

  /** call out to server */
  /** invoke with callback */
  // @Transactional()
  // async callout(action: CallgentFunctionDto, req: any) {
  //   // get server endpoint(sep), and sAdaptor
  //   const sEndpoint = null; // await this.findOne(action.endpointId);
  //   if (!sEndpoint)
  //     throw new NotFoundException(
  //       `Endpoint not found, id=${action.endpointId}`,
  //     );
  //   const sAdaptor = null; // this.getAdaptor(sEndpoint.adaptorKey, sEndpoint.type);
  //   if (!sAdaptor)
  //     throw new NotFoundException(
  //       `Endpoint#${action.endpointId} adaptor not found, adaptorKey=${sEndpoint.adaptorKey}`,
  //     );

  //   //// async/sync execute action command, given action params/code/req/[specific mapping], with cb
  //   // do specific/AI mapping from task ctx
  //   const params = await this.agentsService.mapParams(action.content, req);
  //   // [async preparing]
  //   // invoking adaptor
  //   const resp = await sAdaptor.invoke(params);
  //   // response handling
  //   return resp;
  //   //// end exec.
  // }
}
