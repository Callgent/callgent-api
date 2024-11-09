import {
  All,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiDefaultResponse,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { EntryType } from '@prisma/client';
import { CallgentsService } from '../../../../callgents/callgents.service';
import { EventListenersService } from '../../../../event-listeners/event-listeners.service';
import { JwtGuard } from '../../../../infra/auth/jwt/jwt.guard';
import { Utils } from '../../../../infra/libs/utils';
import { PrismaTenancyService } from '../../../../infra/repo/tenancy/prisma-tenancy.service';
import { EntriesService } from '../../../entries.service';
import { ClientRequestEvent } from '../../../events/client-request.event';
import { RequestRequirement } from '../../dto/request-requirement.dto';

/** global rest-api entry entry */
@ApiTags('Client Entry: Rest-API')
@UseGuards(new JwtGuard(true))
@Controller('rest')
export class RestApiController {
  constructor(
    protected readonly callgentsService: CallgentsService,
    @Inject('EntriesService')
    protected readonly entriesService: EntriesService,
    protected readonly eventListenersService: EventListenersService,
    private readonly tenancyService: PrismaTenancyService,
  ) {}

  @ApiOperation({
    summary: 'To request the callgent with requirement description',
    description:
      'AI agent will generate code to invoke several functional endpoints to fulfill the requirement.',
  })
  @ApiDefaultResponse({
    description:
      'every response contains request id and conversational task id',
    headers: {
      'x-callgent-reqId': { description: 'unique request id' },
      'x-callgent-taskId': { description: 'conversational task id' },
    },
  })
  @ApiHeader({
    name: 'x-callgent-progressive',
    required: false,
    description: 'progressive request responder',
  })
  @Post('request/:callgentId/:entryId')
  @ApiUnauthorizedResponse()
  async request(
    @Body() req: RequestRequirement,
    @Headers('x-callgent-progressive') progressive?: string,
  ) {
    // TODO
  }

  @All('invoke/:callgentId/:entryId/*')
  @ApiOperation({
    summary: 'To invoke the specific functional endpoint.',
  })
  @ApiDefaultResponse({
    description:
      'every response contains request id and conversational task id',
    headers: {
      'x-callgent-reqId': { description: 'unique request id' },
      'x-callgent-taskId': { description: 'conversational task id' },
    },
  })
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
  // @ApiHeader({ name: 'x-callgent-taskId', required: false })
  // @ApiHeader({
  //   name: 'x-callgent-progressive',
  //   required: false,
  //   description: 'progressive request responder',
  // })
  @ApiHeader({ name: 'x-callgent-callback', required: false })
  @ApiHeader({ name: 'x-callgent-timeout', required: false })
  @ApiUnauthorizedResponse()
  async invoke(
    @Req() req,
    @Res() res,
    @Param('callgentId') callgentId: string,
    @Param('entryId') entryId?: string,
    // @Headers('x-callgent-taskId') taskId?: string,
    // @Headers('x-callgent-progressive') progressive?: string,
    @Headers('x-callgent-callback') callback?: string,
    @Headers('x-callgent-timeout') timeout?: string,
  ) {
    const basePath = `invoke/${callgentId}/${entryId}/`;
    let epName = req.url.substr(req.url.indexOf(basePath) + basePath.length);
    if (epName) epName = Utils.formalApiName(req.method, '/' + epName);

    const callerId = req.user?.sub; // || req.ip || req.socket.remoteAddress;
    // TODO owner defaults to caller callgent
    // find callgent cep, then set tenantPk
    const { entry, callgent } = await this._load(callgentId, entryId);

    const {
      statusCode: code,
      data,
      message,
    } = await this.eventListenersService.emit(
      new ClientRequestEvent(
        entry.id,
        entry.adaptorKey,
        req,
        null,
        {
          callgentId,
          callgentName: callgent.name,
          callerId,
          // progressive, FIXME progressive not supported for invoking?
          epName,
        },
        callback,
      ),
      parseInt(timeout) || 0, //  sync timeout
    );

    const headers = {
      'x-callgent-reqId': data.id,
      'x-callgent-taskId': data.taskId,
    };
    code && (headers['x-callgent-status'] = code);
    message && (headers['x-callgent-message'] = message);

    const resp = data?.context.resp;
    if (resp) {
      resp.headers && Object.assign(headers, resp.headers);
      res
        .status(resp.status)
        .headers(headers)
        .statusText(resp.statusText)
        .send(resp.data);
      return;
    }

    // 1: processing, 0: done, 2: pending: waiting for external event trigger to to resume, <0: error
    const statusCode = code ? (code < 0 ? 418 : code < 100 ? 102 : code) : 200;
    res
      .status(statusCode)
      .headers(headers)
      .send({ data, statusCode: code, message });
  }

  @ApiOperation({
    description:
      'Inquiry the result of an invocation request. TODO: Socket Mode',
  })
  @Get('/result/:requestId')
  async invokeResult(@Param('requestId') reqId: string) {
    // FIXME
    return null;
  }

  private async _load(callgentId: string, entryId: string) {
    // TODO owner defaults to caller callgent
    // find callgent cep, then set tenantPk
    const entry = await this.entriesService.$findFirstByType(
      EntryType.CLIENT,
      callgentId,
      'restAPI',
      entryId,
    );
    if (!entry)
      throw new NotFoundException(
        'Entry not found for callgent: ' + callgentId,
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

  /**
   * 1. push(task): {
   * 2. mapping,
   * 3. progressive param, ? manual/ai?
   * 4. auth, invoke,-> }
   * 5. reply -> confirm task
   */
  // @Post('reply/:authToken')
  // async postReply(@Param('authToken') authToken: string, @Body() body: object) {
  //   // verify the authToken
  //   const caller: JwtPayload = await this.verifyAppToken(authToken);
  //   if (!caller) throw new UnauthorizedException();

  //   // return this.called(authToken, body);
  // }

  /**
   *
   * 1. called: {
   * 2. verify
   * 3. convert ->
   * 4. create}
   * 5. respond to caller ->
   */
  // async called(authToken: string, callerType: string, body: object) {
  //   // verify the authToken
  //   const caller: JwtPayload = await this.verifyAppToken(authToken);
  //   if (!caller) throw new UnauthorizedException();

  //   const dto = await this.convertToTask(callerType, body, caller);
  //   if (!dto?.callgent)
  //     throw new BadRequestException('callgent id is missing');

  //   const [task] = await this.tasksService.create(dto);

  //   // TODO instant syncResult to respond
  //   return task;
  // }

  // /** jwt with aud == 'authToken' */
  // async verifyAppToken(authToken: string) {
  //   const payload: JwtPayload = await this.authTokensService.verify(
  //     authToken,
  //     'API_KEY',
  //   );
  //   return payload;
  // }

  /** implementation for postmarkapp.com */
  // async convertToTask(
  //   callerType: string,
  //   body: object,
  //   caller: JwtPayload,
  // ): Promise<TaskDto & { callerType: string; createdBy: string }> {
  //   const plugin: CallerPlugin = this.pluginsService.getPlugin(callerType);
  //   if (!plugin?.convertToTask)
  //     throw new BadRequestException(
  //       `plugin callerType=${callerType} not found`,
  //     );

  //   const task: TaskDto = await plugin.convertToTask(callerType, body, caller);
  //   if (!task) return;

  //   return { ...task, callerType, createdBy: caller.sub };
  // }
}
