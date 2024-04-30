import {
  All,
  Controller,
  Get,
  Headers,
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
import { BotletsService } from '../../../../botlets/botlets.service';

/** global rest-api endpoint entry */
@ApiTags('Client Endpoint: Rest-API')
@UseGuards(new JwtGuard(true))
@Controller('botlets')
export class RestApiController {
  constructor(
    protected readonly botletsService: BotletsService,
    @Inject('EndpointsService')
    protected readonly endpointsService: EndpointsService,
    protected readonly eventListenersService: EventListenersService,
  ) {}

  @ApiOperation({
    description: 'rest-api client endpoint entry of multiple botlets',
  })
  @ApiParam({
    name: 'uuid',
    required: true,
    description: "comma separated botlet uuids, eg: 'uuid1,uuid2,uuid3'. ",
  })
  @ApiParam({
    name: 'endpoint',
    required: false,
    description: 'endpoint uuid, optional: "/botlets/the-uuid`//`invoke/api/"',
  })
  @ApiParam({
    name: 'NOTE: swagger does not support wildcard param. Just document here',
    required: false,
    description:
      '../invoke/api/`resource-path-here`. the wildcard path, optional: "../invoke/api/"',
  })
  @ApiHeader({ name: 'x-botlet-taskId', required: false })
  @ApiHeader({
    name: 'x-botlet-progressive',
    required: false,
    description: 'progressive request responder',
  })
  @ApiHeader({ name: 'x-botlet-callback', required: false })
  @All(':uuid/:endpoint/invoke/api/*')
  async execute(
    @Req() req,
    @Param('uuid') botletId: string,
    @Param('endpoint') endpoint?: string,
    @Headers('x-botlet-taskId') taskId?: string,
    @Headers('x-botlet-progressive') progressive?: string,
    @Headers('x-botlet-callback') callback?: string,
  ) {
    const basePath = `${botletId}/${endpoint}/invoke/api/`;
    let funName = req.url.substr(req.url.indexOf(basePath) + basePath.length);
    if (funName)
      funName = RestAPIAdaptor.formalActionName(req.method, '/' + funName);

    const caller = req.user?.sub || req.ip || req.socket.remoteAddress;
    // TODO owner defaults to caller botlet
    // find botlet cep, then set tenantId
    const cep = await this.endpointsService.$findFirstByType(
      EndpointType.CLIENT,
      botletId,
      'restAPI',
      endpoint,
    );
    if (!cep)
      throw new NotFoundException(
        'restAPI endpoint not found for botlet: ' + botletId,
      );
    const botlet = await this.botletsService.findOne(botletId, { name: true });
    if (!botlet) throw new NotFoundException('botlet not found: ' + botletId);

    return this.eventListenersService.emit(
      new ClientRequestEvent(cep.uuid, taskId, cep.adaptorKey, req, {
        botletId,
        botletName: botlet.name,
        caller,
        callback,
        progressive,
        funName,
      }),
      // FIXME sync timeout
    );
  }

  @ApiOperation({
    description:
      'Inquiry the result of an invocation request. TODO: Socket Mode',
  })
  @Get('/invoke/result/:requestId')
  async invokeResult(@Param('requestId') reqId: string) {
    // FIXME
    return reqId;
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
  //   if (!dto?.botlet)
  //     throw new BadRequestException('botlet uuid is missing');

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
