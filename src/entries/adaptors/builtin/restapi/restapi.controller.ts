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
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiConsumes,
  ApiDefaultResponse,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { EntryType } from '@prisma/client';
import { FastifyReply } from 'fastify';
import { diskStorage } from 'fastify-multer';
import { File } from 'fastify-multer/lib/interfaces';
import { FastifyFilesInterceptor } from 'nest-fastify-multer';
import path from 'path';
import { CallgentsService } from '../../../../callgents/callgents.service';
import { EventListenersService } from '../../../../event-listeners/event-listeners.service';
import { FilesService } from '../../../../files/files.service';
import { JwtGuard } from '../../../../infras/auth/jwt/jwt.guard';
import { Utils } from '../../../../infras/libs/utils';
import { PrismaTenancyService } from '../../../../infras/repo/tenancy/prisma-tenancy.service';
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
    private readonly filesService: FilesService,
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
  @ApiParam({
    name: 'callgentId',
    required: true,
    description: 'Callgent id',
  })
  @ApiParam({
    name: 'entryId',
    required: false,
    description: 'Client entry id, mey empty: "/rest/invoke/:callgent-id`/`"',
  })
  @ApiQuery({
    name: 'taskId',
    required: false,
    description: 'Conversation Id',
  })
  @ApiConsumes('multipart/form-data')
  @ApiUnauthorizedResponse()
  // write into tmp file
  @FastifyFilesInterceptor('files', 8, { storage: diskStorage({}) })
  @Post('request/:callgentId/:entryId')
  async request(
    @Req() req,
    @Res() res,
    @Body(new ValidationPipe()) requirement: RequestRequirement,
    @Param('callgentId') callgentId: string,
    @Param('entryId') entryId?: string,
    @Query('taskId') taskId?: string,
    @UploadedFiles() tmpFiles?: File[],
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
    requirement.files = await this.filesService.move(
      tmpFiles,
      path.join(e.getTaskCwd(this.filesService.UPLOAD_BASE_DIR), 'upload'),
    );

    const data = await this.eventListenersService.emit(e);
    // preprocess, c-auth, load target events, load eps,
    // chooseEndpoints, map2Endpoints(s-auth for all eps/entries, invoke-SEPs)

    const headers = {
      'x-callgent-reqId': data.id,
      'x-callgent-taskId': data.taskId,
    };

    const resp = data?.context.resp;
    if (resp) {
      resp.headers && Object.assign(headers, resp.headers);
      const body = resp.data || {
        statusCode: resp.status,
        message: resp.statusText,
      };
      res.status(resp.status).headers(headers).send(body);
      return body;
    }

    // 1: processing, 0: done, 2: pending: waiting for external event trigger to to resume, <0: error
    const statusCode = data.statusCode;
    const message = data.message;
    delete data.statusCode, delete data.message;
    const status = statusCode
      ? statusCode < 0
        ? 418
        : statusCode < 200
          ? 202
          : statusCode
      : 200;
    const body = { data, statusCode, message };
    res.status(status).headers(headers).send(body);
    return body;
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
  @ApiAcceptedResponse({
    description:
      'You may retrieve response result by `/api/rest/result/{requestId}` or `x-callgent-callback`',
  })
  async invoke(
    @Req() req,
    @Res() res: FastifyReply,
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

    // find callgent cep, then set tenantPk
    const { entry, callgent } = await this._load(callgentId, entryId);
    // TODO owner defaults to caller callgent
    const callerId = req.user?.sub; // || req.ip || req.socket.remoteAddress;
    const title = 'Invoke: ' + epName;
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
    const statusCode = data.statusCode;
    const message = data.message;
    statusCode && (headers['x-callgent-status'] = statusCode);
    message && (headers['x-callgent-message'] = message);
    delete data.statusCode, delete data.message;

    const resp = data?.context.resp;
    if (resp) {
      resp.headers && Object.assign(headers, resp.headers);
      const body = resp.data || {
        statusCode: resp.status,
        message: resp.statusText,
      };
      res.status(resp.status).headers(headers).send(body);
      return body;
    }

    // 1: processing, 0: done, 2: pending: waiting for external event trigger to to resume, <0: error
    const status = statusCode
      ? statusCode < 0
        ? 418
        : statusCode < 200
          ? 202
          : statusCode
      : 200;
    const body = { data, statusCode, message };
    res.status(status).headers(headers).send(body);
    return body;
  }

  // TODO invoke with multipart body

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
        '`restAPI` Client Entry not found for callgent: ' + callgentId,
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
