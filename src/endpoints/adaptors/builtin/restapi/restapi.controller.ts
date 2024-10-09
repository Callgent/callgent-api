import {
  All,
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { EndpointType } from '@prisma/client';
import { CallgentsService } from '../../../../callgents/callgents.service';
import { EventListenersService } from '../../../../event-listeners/event-listeners.service';
import { JwtGuard } from '../../../../infra/auth/jwt/jwt.guard';
import { Utils } from '../../../../infra/libs/utils';
import { EndpointsService } from '../../../endpoints.service';
import { ClientRequestEvent } from '../../../events/client-request.event';

/** global rest-api endpoint entry */
@ApiTags('Client Endpoint: Rest-API')
@UseGuards(new JwtGuard(true))
@Controller('rest')
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
    name: 'callgentId',
    required: true,
    description: 'Callgent id',
  })
  @ApiParam({
    name: 'endpointId',
    required: false,
    description:
      'Client endpoint id, mey empty: "/rest/invoke/:callgent-id`//`.."',
  })
  @ApiParam({
    name: 'NOTE: swagger does not support wildcard param. Just document here',
    required: false,
    description:
      'rest/invoke/:callgentId/:endpointId/`resource-path-here`. the wildcard path, may be empty',
  })
  @ApiHeader({ name: 'x-callgent-taskId', required: false })
  @ApiHeader({
    name: 'x-callgent-progressive',
    required: false,
    description: 'progressive request responder',
  })
  @ApiHeader({ name: 'x-callgent-callback', required: false })
  @ApiHeader({ name: 'x-callgent-timeout', required: false })
  @All('invoke/:callgentId/:endpointId/*')
  @ApiOperation({ summary: 'To invoke the specific functional endpoint.' })
  @ApiUnauthorizedResponse()
  async invoke(
    @Req() req,
    @Res() res,
    @Param('callgentId') callgentId: string,
    @Param('endpointId') endpointId?: string,
    @Headers('x-callgent-taskId') taskId?: string,
    @Headers('x-callgent-progressive') progressive?: string,
    @Headers('x-callgent-callback') callback?: string,
    @Headers('x-callgent-timeout') timeout?: string,
  ) {
    const basePath = `invoke/${callgentId}/${endpointId}/`;
    let funName = req.url.substr(req.url.indexOf(basePath) + basePath.length);
    if (funName) funName = Utils.formalApiName(req.method, '/' + funName);

    const callerId = req.user?.sub; // || req.ip || req.socket.remoteAddress;
    // TODO owner defaults to caller callgent
    // find callgent cep, then set tenantPk
    const cep = await this.endpointsService.$findFirstByType(
      EndpointType.CLIENT,
      callgentId,
      'restAPI',
      endpointId,
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

    const { data, statusCode, message } = await this.eventListenersService.emit(
      new ClientRequestEvent(cep.id, taskId, cep.adaptorKey, callback, req, {
        callgentId,
        callgentName: callgent.name,
        callerId,
        progressive,
        funName,
      }),
      parseInt(timeout) || 0, //  sync timeout
    );
    // FIXME data
    res
      .status(statusCode < 0 ? 418 : statusCode < 200 ? 200 : statusCode)
      .send({ data, statusCode, message });
    // code cannot < 0
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
