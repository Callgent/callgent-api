import {
  All,
  Controller,
  Get,
  Headers,
  HttpException,
  Inject,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { EndpointType } from '@prisma/client';
import { EventListenersService } from '../../../../event-listeners/event-listeners.service';
import { JwtGuard } from '../../../../infra/auth/jwt/jwt.guard';
import { EndpointsService } from '../../../endpoints.service';
import { ClientRequestEvent } from '../../../events/client-request.event';
import { RestAPIAdaptor } from './restapi.adaptor';
import { CallgentsService } from '../../../../callgents/callgents.service';

/** global rest-api endpoint entry */
@ApiTags('Client Endpoint: Rest-API')
@UseGuards(new JwtGuard(true))
@Controller('callgents')
export class RestApiController {
  constructor(
    protected readonly callgentsService: CallgentsService,
    @Inject('EndpointsService')
    protected readonly endpointsService: EndpointsService,
    protected readonly eventListenersService: EventListenersService,
  ) {}

  @ApiOperation({
    description: 'rest-api client endpoint entry of multiple callgents',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: "comma separated callgent ids, eg: 'id1,id2,id3'. ",
  })
  @ApiParam({
    name: 'endpoint',
    required: false,
    description: 'endpoint id, optional: "/callgents/the-id`//`invoke/api/"',
  })
  @ApiParam({
    name: 'NOTE: swagger does not support wildcard param. Just document here',
    required: false,
    description:
      '../invoke/api/`resource-path-here`. the wildcard path, optional: "../invoke/api/"',
  })
  @ApiHeader({ name: 'x-callgent-taskId', required: false })
  @ApiHeader({
    name: 'x-callgent-progressive',
    required: false,
    description: 'progressive request responder',
  })
  @ApiHeader({ name: 'x-callgent-callback', required: false })
  @All(':id/:endpoint/invoke/api/*')
  async execute(
    @Req() req,
    @Param('id') callgentId: string,
    @Param('endpoint') endpoint?: string,
    @Headers('x-callgent-taskId') taskId?: string,
    @Headers('x-callgent-progressive') progressive?: string,
    @Headers('x-callgent-callback') callback?: string,
  ) {
    const basePath = `${callgentId}/${endpoint}/invoke/api/`;
    let funName = req.url.substr(req.url.indexOf(basePath) + basePath.length);
    if (funName)
      funName = RestAPIAdaptor.formalActionName(req.method, '/' + funName);

    const caller = req.user?.sub || req.ip || req.socket.remoteAddress;
    // TODO owner defaults to caller callgent
    // find callgent cep, then set tenantPk
    const cep = await this.endpointsService.$findFirstByType(
      EndpointType.CLIENT,
      callgentId,
      'restAPI',
      endpoint,
    );
    if (!cep)
      throw new NotFoundException(
        'restAPI endpoint not found for callgent: ' + callgentId,
      );
    const callgent = await this.callgentsService.findOne(callgentId, {
      name: true,
    });
    if (!callgent)
      throw new NotFoundException('callgent not found: ' + callgentId);

    const { event, statusCode, message } =
      await this.eventListenersService.emit(
        new ClientRequestEvent(cep.id, taskId, cep.adaptorKey, req, callback, {
          callgentId,
          callgentName: callgent.name,
          caller,
          progressive,
          funName,
        }),
        // FIXME sync timeout
      );
    // FIXME data
    if (statusCode < 400) return { event, statusCode, message };

    throw new HttpException(message, statusCode);
  }

  @ApiOperation({
    description:
      'Inquiry the result of an invocation request. TODO: Socket Mode',
  })
  @Get('/invoke/result/:requestId')
  async invokeResult(@Param('requestId') reqId: string) {
    // FIXME
    return null;
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
