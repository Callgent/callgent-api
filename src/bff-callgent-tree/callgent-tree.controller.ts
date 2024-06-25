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
import { CallgentsService } from '../callgents/callgents.service';
import { CreateCallgentDto } from '../callgents/dto/create-callgent.dto';
import { EndpointsService } from '../endpoints/endpoints.service';
import { JwtGuard } from '../infra/auth/jwt/jwt.guard';
import { Callgent } from '@prisma/client';

@UseGuards(JwtGuard)
@Controller('bff')
export class CallgentTreeController {
  constructor(
    private readonly callgentsService: CallgentsService,
    @Inject('EndpointsService')
    private readonly endpointsService: EndpointsService,
  ) {}
  private readonly logger = new Logger(CallgentTreeController.name);

  /**
   * @returns callgent with endpoints tree
   */
  @Get('callgent-endpoints/:uuid')
  async findOne(@Param('uuid') uuid: string) {
    const callgent = await this.callgentsService.findOne(uuid);
    if (!callgent) throw new NotFoundException();

    const data = await this._callgentTree(callgent);

    return { data };
  }

  /**
   * @returns callgent with endpoints tree
   */
  @Post('callgent-endpoints')
  async create(@Req() req, @Body() dto: CreateCallgentDto) {
    const callgent = await this.callgentsService.create(dto, req.user.sub);
    const data = await this._callgentTree(callgent);
    return { data };
  }

  private async _callgentTree(callgent: Callgent) {
    const endpoints = await this.endpointsService.findAll({
      select: { callgentUuid: false },
      where: { callgentUuid: callgent.uuid },
    });

    const [CEP, SEP, EEP] = [[], [], []];
    endpoints.forEach((ep: any) => {
      ep = { ...ep, id: ep.uuid, uuid: undefined };
      if (ep.type == 'CLIENT') {
        CEP.push(ep);
      } else if (ep.type == 'SERVER') {
        SEP.push(ep);
      } else if (ep.type == 'EVENT') EEP.push(ep);
      else
        this.logger.error(
          `Unknown endpoint type: ${ep.type}, ep.uuid=${ep.uuid}`,
        );
    });

    const data = {
      id: callgent.uuid,
      name: callgent.name,
      createdAt: callgent.createdAt,
      updatedAt: callgent.updatedAt,
      children: [
        { id: 'CEP', name: 'CEP', children: CEP },
        { id: 'SEP', name: 'SEP', children: SEP },
        { id: 'EEP', name: 'EEP', children: EEP },
      ],
    };
    return data;
  }
}
