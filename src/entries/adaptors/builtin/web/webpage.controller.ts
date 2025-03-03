import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { EntryType } from '@prisma/client';
import { CallgentsService } from '../../../../callgents/callgents.service';
import { EventListenersService } from '../../../../event-listeners/event-listeners.service';
import { JwtGuard } from '../../../../infras/auth/jwt/jwt.guard';
import { Utils } from '../../../../infras/libs/utils';
import { PrismaTenancyService } from '../../../../infras/repo/tenancy/prisma-tenancy.service';
import { EntriesService } from '../../../entries.service';
import { ClientRequestEvent } from '../../../events/client-request.event';
import { RequestRequirement } from '../../dto/request-requirement.dto';

/** to generate web pages based on request and callgent endpoints */
@ApiTags('Client Entry: Webpage')
@UseGuards(new JwtGuard(true))
@Controller('webpage')
export class WebpageController {
  constructor(
    protected readonly callgentsService: CallgentsService,
    @Inject('EntriesService')
    protected readonly entriesService: EntriesService,
    protected readonly eventListenersService: EventListenersService,
    private readonly tenancyService: PrismaTenancyService,
  ) {}

  @ApiOperation({
    summary:
      'Request with requirement description, to instantly generate web page.',
    description:
      'AI agent will instantly generate page to fulfill the requirement.',
  })
  @ApiHeader({
    name: 'x-callgent-progressive',
    required: false,
    description: 'progressive request responder',
  })
  @ApiQuery({
    name: 'taskId',
    required: false,
    description: 'Conversation Id',
  })
  @Post('request/:callgentId/:entryId')
  async request(
    @Body() requirement: RequestRequirement, // FIXME: files
    @Param('callgentId') callgentId: string,
    @Req() req,
    @Res() res,
    @Param('entryId') entryId?: string,
    @Query('taskId') taskId?: string,
    @Headers('x-callgent-progressive') progressive?: string,
  ) {
    const { entry, callgent } = await this._load(callgentId, entryId);
    const title = 'Request: ' + Utils.truncate(requirement.requirement, 120);
    const calledBy = req.user?.sub;
    const paidBy = calledBy || callgent.createdBy;

    const e = new ClientRequestEvent(
      entry.id,
      entry.adaptorKey,
      requirement,
      taskId,
      title,
      paidBy,
      calledBy,
      {
        callgentId,
        callgentName: callgent.name,
        callerId: req.user?.sub,
        progressive,
      },
      // callback, // 是否需要异步返回结果
    );
    e.context.callgent = callgent;
    const data = await this.eventListenersService.emit(e);
    // event listeners:
    // preprocess, c-auth, load target events, load eps, (choose eps?),
    // [gen view/model/view-model from summary, response]
    // remove: | chooseEndpoints, map2Endpoints,s-auth for all eps/entries, invoke-service

    // return generated webpage

    const ctx = data?.context;
    const status = data.statusCode;
    const message = data.message;
    // delete data.statusCode, delete data.message;
    // code cannot < 0
    res.status(status < 0 ? 418 : status < 200 ? 200 : status).send({
      data: { ...data, response: ctx.resp },
      statusCode: status,
      message,
    });
  }

  @ApiOperation({ summary: 'To invoke pregenerated pages.' })
  @ApiParam({
    name: 'callgentId',
    required: true,
    description: 'Callgent id',
  })
  @ApiParam({
    name: 'entryId',
    required: false,
    description:
      'Client entry id, mey empty: "/rest/invoke/:callgent-id`//`.."',
  })
  @ApiParam({
    name: 'NOTE: swagger does not support wildcard param. Just document here',
    required: false,
    description:
      'rest/invoke/:callgentId/:entryId/`resource-path-here`. the wildcard path, may be empty',
  })
  @ApiHeader({ name: 'x-callgent-callback', required: false })
  @ApiHeader({ name: 'x-callgent-timeout', required: false })
  @Get('invoke/:callgentId/:entryId/*')
  @ApiUnauthorizedResponse()
  async invoke(
    @Req() req,
    @Res() res,
    @Param('callgentId') callgentId: string,
    @Param('entryId') entryId?: string,
    @Headers('x-callgent-progressive') progressive?: string,
    @Headers('x-callgent-callback') callback?: string,
    @Headers('x-callgent-timeout') timeout?: string,
  ) {
    const basePath = `invoke/${callgentId}/${entryId}/`;
    let pageName = req.url.substr(req.url.indexOf(basePath) + basePath.length);
    if (pageName) pageName = Utils.formalApiName(req.method, '/' + pageName);
    // FIXME: invoke page name, not epName
    // preprocess, c-auth, [load code, view route]

    const { entry, callgent } = await this._load(callgentId, entryId);
    const title = 'Invoke: ' + pageName;
    const calledBy = req.user?.sub;
    const paidBy = calledBy || callgent.createdBy;

    const data = await this.eventListenersService.emit(
      new ClientRequestEvent(
        entry.id,
        entry.adaptorKey,
        req,
        null,
        title,
        paidBy,
        calledBy,
        {
          callgentId,
          callgentName: callgent.name,
          callerId: req.user?.sub,
          progressive,
        },
        callback,
      ),
      parseInt(timeout) || 0, //  sync timeout
    );
    // FIXME data
    const status = data.statusCode;
    // code cannot < 0
    res.status(status < 0 ? 418 : status < 200 ? 200 : status).send({ data });
  }

  private async _load(callgentId: string, entryId: string) {
    // TODO owner defaults to caller callgent
    // find callgent cep, then set tenantPk
    const entry = await this.entriesService.$findFirstByType(
      EntryType.CLIENT,
      callgentId,
      'Webpage',
      entryId,
    );
    if (!entry)
      throw new NotFoundException(
        '`Webpage` Client Entry not found for callgent: ' + callgentId,
      );
    this.tenancyService.setTenantId(entry.tenantPk);

    const callgent = await this.callgentsService.findOne(callgentId, {
      id: true,
      name: true,
      summary: true,
      instruction: true,
    });
    if (!callgent)
      throw new NotFoundException('callgent not found: ' + callgentId);
    return { entry, callgent };
  }
}
