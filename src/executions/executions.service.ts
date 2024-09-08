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
}
