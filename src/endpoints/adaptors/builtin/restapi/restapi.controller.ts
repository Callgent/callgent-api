import {
  All,
  Controller,
  Get,
  Headers,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../../../../infra/auth/jwt/jwt.guard';
import { TaskActionsService } from '../../../../task-actions/task-actions.service';
import { RestAPIAdaptor } from './restapi.adaptor';

/** global rest-api endpoint entry */
@ApiTags('Client Endpoint: Rest-API')
@UseGuards(new JwtGuard(true))
@Controller('botlets')
export class RestApiController {
  constructor(protected readonly taskActionsService: TaskActionsService) {}

  @ApiOperation({
    description: 'rest-api client endpoint entry of multiple botlets',
  })
  @ApiParam({
    name: 'uuids',
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
  @ApiHeader({ name: 'taskId', required: false })
  @ApiHeader({
    name: 'owner',
    required: false,
    description: 'action request owner, responsible for progressive response',
  })
  @ApiHeader({ name: 'callback', required: false })
  @All(':uuids/:endpoint/invoke/api/*')
  async execute(
    @Req() req,
    @Param('uuids') botletStr: string,
    @Param('endpoint') endpoint?: string,
    @Headers('taskId') taskId?: string,
    @Headers('owner') owner?: string,
    @Headers('callback') callback?: string,
  ) {
    const botlets = botletStr.split(',').filter((b) => !!b);

    const basePath = `${botletStr}/${endpoint}/invoke/api/`;
    let reqFunction = req.url.substr(
      req.url.indexOf(basePath) + basePath.length,
    );
    if (reqFunction)
      reqFunction = RestAPIAdaptor.formalActionName(
        req.method,
        '/' + reqFunction,
      );

    const caller = req.user?.sub || req.ip || req.socket.remoteAddress;
    // TODO owner defaults to caller botlet
    return this.taskActionsService.$execute({
      taskId,
      caller,
      owner,
      botletUuids: botlets,
      rawReq: req,
      reqAdaptorKey: 'restAPI',
      reqEndpointUuid: endpoint,
      reqFunction,
      callback,
    });
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
