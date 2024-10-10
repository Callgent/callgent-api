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
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { EndpointsService } from '../../endpoints/endpoints.service';
import { CallgentRealmsService } from '../../callgent-realms/callgent-realms.service';
import { CallgentsService } from '../../callgents/callgents.service';
import { CallgentDto } from '../../callgents/dto/callgent.dto';
import { CreateCallgentDto } from '../../callgents/dto/create-callgent.dto';
import { EntriesService } from '../../entries/entries.service';
import { JwtGuard } from '../../infra/auth/jwt/jwt.guard';

@ApiTags('BFF')
@ApiSecurity('defaultBearerAuth')
@UseGuards(JwtGuard)
@Controller('bff')
export class CallgentTreeController {
  constructor(
    private readonly callgentsService: CallgentsService,
    @Inject('EntriesService')
    private readonly entriesService: EntriesService,
    @Inject('EndpointsService')
    private readonly endpointsService: EndpointsService,
    @Inject('CallgentRealmsService')
    private readonly callgentRealmsService: CallgentRealmsService,
  ) {}
  private readonly logger = new Logger(CallgentTreeController.name);

  /**
   * @returns callgent with entries tree
   */
  @Get('callgent-entries/:id')
  async findOne(@Param('id') id: string) {
    const callgent = await this.callgentsService.findOne(id);
    if (!callgent) throw new NotFoundException();

    const data = await this._callgentTree(callgent);

    return { data };
  }

  /**
   * @returns new or existing callgent with entries tree
   */
  @Post('callgent-entries')
  async create(@Req() req, @Body() dto: CreateCallgentDto) {
    let callgent = (await this.callgentsService.getByName(
      dto.name,
    )) as CallgentDto;
    if (!callgent)
      callgent = await this.callgentsService.create(dto, req.user.sub);
    const data = await this._callgentTree(callgent);
    return { data };
  }

  private async _callgentTree(callgent: CallgentDto) {
    const entries = await this.entriesService.findAll({
      select: { callgentId: false },
      where: { callgentId: callgent.id },
    });

    const [CEP, SEP, EEP] = [[], [], []];
    await Promise.all(
      entries.map(async (ep: any) => {
        ep = { ...ep, id: ep.id, pk: undefined };
        if (ep.type == 'CLIENT') {
          CEP.push(ep);
        } else if (ep.type == 'SERVER') {
          ep.children = await this.endpointsService.findAll({
            select: {
              pk: false,
              params: false,
              responses: false,
              callgentId: false,
            },
            where: { entryId: ep.id },
          });
          SEP.push(ep);
        } else if (ep.type == 'EVENT') {
          EEP.push(ep);
          // TODO listeners as children
        } else
          this.logger.error(`Unknown entry type: ${ep.type}, ep.id=${ep.id}`);
      }),
    );

    const realms =
      (await this.callgentRealmsService.findAll({
        where: { callgentId: callgent.id },
        select: { callgentId: false, secret: false },
      })) || [];

    const data = {
      id: callgent.id,
      realms,
      name: callgent.name,
      createdAt: callgent.createdAt,
      updatedAt: callgent.updatedAt,
      children: [
        {
          id: 'CLIENT',
          name: 'Client Entries (CEN)',
          hint: 'Adaptor to accept request to the callgent',
          children: CEP,
        },
        {
          id: 'SERVER',
          name: 'Server Entries (SEN)',
          hint: 'Adaptor to forward the request to actual service',
          children: SEP,
        },
        {
          id: 'EVENT',
          name: 'Event Entries (EEN)',
          hint: 'To accept service events and trigger your registered listener',
          children: EEP,
        },
      ],
    };
    return data;
  }
}
