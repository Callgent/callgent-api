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
import { CallgentRealmsService } from '../../callgent-realms/callgent-realms.service';
import { CallgentsService } from '../../callgents/callgents.service';
import { CallgentDto } from '../../callgents/dto/callgent.dto';
import { CreateCallgentDto } from '../../callgents/dto/create-callgent.dto';
import { EndpointsService } from '../../endpoints/endpoints.service';
import { EntriesService } from '../../entries/entries.service';
import { JwtGuard } from '../../infras/auth/jwt/jwt.guard';

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

    const cas = this.entriesService.listAdaptors(true);
    const sas = this.entriesService.listAdaptors(false);

    const [CEN, SEN, EEN] = [[], [], []];
    await Promise.all(
      entries.map(async (en: any) => {
        en = { ...en, id: en.id, pk: undefined, icon: undefined };
        if (en.type == 'CLIENT') {
          CEN.push(en);
          en.icon_url = cas[en.adaptorKey];
        } else if (en.type == 'SERVER') {
          en.children = await this.endpointsService.findAll({
            select: {
              pk: false,
              params: false,
              responses: false,
              callgentId: false,
            },
            where: { entryId: en.id },
          });
          SEN.push(en);
          en.icon_url = sas[en.adaptorKey];
        } else if (en.type == 'EVENT') {
          EEN.push(en);
          en.icon_url = cas[en.adaptorKey];
          // TODO listeners as children
        } else
          this.logger.error(`Unknown entry type: ${en.type}, ep.id=${en.id}`);
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
      icon_url: callgent.avatar,
      createdAt: callgent.createdAt,
      updatedAt: callgent.updatedAt,
      children: [
        {
          id: 'CLIENT',
          name: 'Client Entries (CEN)',
          hint: 'Adaptor to accept request to the callgent',
          children: CEN,
        },
        {
          id: 'SERVER',
          name: 'Server Entries (SEN)',
          hint: 'Adaptor to forward the request to actual service',
          children: SEN,
        },
        {
          id: 'EVENT',
          name: 'Event Entries (EEN)',
          hint: 'To accept service events and trigger your registered listener',
          children: EEN,
        },
      ],
    };
    return data;
  }
}
