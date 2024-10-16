import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { EntryType } from '@prisma/client';
import { IsNotEmpty, IsString } from 'class-validator';
import { CallgentsService } from '../../../../callgents/callgents.service';
import { EventListenersService } from '../../../../event-listeners/event-listeners.service';
import { JwtGuard } from '../../../../infra/auth/jwt/jwt.guard';
import { Utils } from '../../../../infra/libs/utils';
import { EntriesService } from '../../../entries.service';
import { ClientRequestEvent } from '../../../events/client-request.event';

export class Requirement {
  @ApiProperty({
    description: 'Requirement for callgent to fulfill.',
    example:
      'I want to apply for the Senior Algorithm Engineer based in Singapore.',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  requirement: string;
}

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
  ) {}

  @ApiOperation({
    summary:
      'Request with requirement description, to instantly generate web page.',
    description:
      'AI agent will instantly generate page to fulfill the requirement.',
  })
  @ApiQuery({
    name: 'taskId',
    required: false,
    description: 'Conversation Id',
  })
  @Get('request/:callgentId/:entryId')
  async request(
    @Body() requirement: Requirement,
    @Param('callgentId') callgentId: string,
    @Req() req,
    @Res() res,
    @Param('entryId') entryId?: string,
    @Query('taskId') taskId?: string,
  ) {
    const { entry, callgent } = await this._load(callgentId, entryId);

    const result = await this.eventListenersService.emit(
      new ClientRequestEvent(
        entry.id,
        taskId,
        entry.adaptorKey,
        requirement,
        {
          callgentId,
          callgentName: callgent.name,
          callerId: req.user?.sub,
          // progressive, // 是否需要渐进式？
        },
        // callback, // 是否需要异步返回结果
      ),
    );
    // event listeners:
    // preprocess, c-auth, load eps, load target events, map2Endpoints,

    // [gen view/model/view-model, response]

    // remove: | s-auth, invoke-service

    // return generated webpage
    const code = result.statusCode || 200;
    res.status(code < 0 ? 418 : code < 200 ? 200 : code).send(result);
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
  @ApiHeader({ name: 'x-callgent-taskId', required: false })
  @ApiHeader({
    name: 'x-callgent-progressive',
    required: false,
    description: 'progressive request responder',
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
    @Headers('x-callgent-taskId') taskId?: string,
    @Headers('x-callgent-progressive') progressive?: string,
    @Headers('x-callgent-callback') callback?: string,
    @Headers('x-callgent-timeout') timeout?: string,
  ) {
    const basePath = `invoke/${callgentId}/${entryId}/`;
    let epName = req.url.substr(req.url.indexOf(basePath) + basePath.length);
    if (epName) epName = Utils.formalApiName(req.method, '/' + epName);

    const { entry, callgent } = await this._load(callgentId, entryId);

    const result = await this.eventListenersService.emit(
      new ClientRequestEvent(
        entry.id,
        taskId,
        entry.adaptorKey,
        req,
        {
          callgentId,
          callgentName: callgent.name,
          callerId: req.user?.sub,
          progressive,
          epName,
        },
        callback,
      ),
      parseInt(timeout) || 0, //  sync timeout
    );
    // FIXME data
    const code = result.statusCode || 200;
    // code cannot < 0
    res.status(code < 0 ? 418 : code < 200 ? 200 : code).send(result);
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
        'restAPI entry not found for callgent: ' + callgentId,
      );
    const callgent = await this.callgentsService.findOne(callgentId, {
      name: true,
    });
    if (!callgent)
      throw new NotFoundException('callgent not found: ' + callgentId);
    return { entry, callgent };
  }
}
