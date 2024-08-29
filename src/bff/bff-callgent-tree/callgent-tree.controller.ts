import {
  Body,
  Controller,
  Get,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Callgent } from '@prisma/client';
import { CallgentFunctionsService } from '../../callgent-functions/callgent-functions.service';
import { CallgentsService } from '../../callgents/callgents.service';
import { CreateCallgentDto } from '../../callgents/dto/create-callgent.dto';
import { EndpointsService } from '../../endpoints/endpoints.service';
import { JwtGuard } from '../../infra/auth/jwt/jwt.guard';

@ApiTags('bff')
@UseGuards(JwtGuard)
@Controller('bff')
export class CallgentTreeController {
  constructor(
    private readonly callgentsService: CallgentsService,
    @Inject('EndpointsService')
    private readonly endpointsService: EndpointsService,
    @Inject('CallgentFunctionsService')
    private readonly callgentFunctionsService: CallgentFunctionsService,
  ) {}
  private readonly logger = new Logger(CallgentTreeController.name);

  /**
   * @returns callgent with endpoints tree
   */
  @Get('callgent-endpoints/:id')
  async findOne(@Param('id') id: string) {
    const callgent = await this.callgentsService.findOne(id);
    if (!callgent) throw new NotFoundException();

    const data = await this._callgentTree(callgent);

    return { data };
  }

  /**
   * @returns new or existing callgent with endpoints tree
   */
  @Post('callgent-endpoints')
  async create(@Req() req, @Body() dto: CreateCallgentDto) {
    let callgent = await this.callgentsService.getByName(dto.name);
    if (!callgent)
      callgent = await this.callgentsService.create(dto, req.user.sub);
    const data = await this._callgentTree(callgent);
    return { data };
  }

  private async _callgentTree(callgent: Callgent) {
    const endpoints = await this.endpointsService.findAll({
      select: { callgentId: false },
      where: { callgentId: callgent.id },
    });

    const [CEP, SEP, EEP] = [[], [], []];
    await Promise.all(
      endpoints.map(async (ep: any) => {
        ep = { ...ep, id: ep.id, pk: undefined };
        if (ep.type == 'CLIENT') {
          CEP.push(ep);
        } else if (ep.type == 'SERVER') {
          ep.children = await this.callgentFunctionsService.findMany({
            select: { pk: false, signature: false, callgentId: false },
            where: { endpointId: ep.id },
          });
          SEP.push(ep);
        } else if (ep.type == 'EVENT') {
          EEP.push(ep);
          // TODO listeners as children
        } else
          this.logger.error(
            `Unknown endpoint type: ${ep.type}, ep.id=${ep.id}`,
          );
      }),
    );

    const data = {
      id: callgent.id,
      name: callgent.name,
      createdAt: callgent.createdAt,
      updatedAt: callgent.updatedAt,
      children: [
        {
          id: 'CLIENT',
          name: 'Client Endpoints (CEP)',
          hint: 'Adaptor to accept request to the callgent',
          children: CEP,
        },
        {
          id: 'SERVER',
          name: 'Server Endpoints (SEP)',
          hint: 'Adaptor to forward the request to actual service',
          children: SEP,
        },
        {
          id: 'EVENT',
          name: 'Event Endpoints (EEP)',
          hint: 'To accept service events and trigger your registered listener',
          children: EEP,
        },
      ],
    };
    return data;
  }
}
