import {
  All,
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EndpointsService } from '../../../endpoints.service';
import { AuthTokensService } from '../auth-tokens/auth-tokens.service';
import { CallerPlugin } from '../endpoints/caller.plugin';
import { PluginsService } from '../endpoints/plugins.service';
import { JwtPayload } from '../infra/auth/jwt/jwt.service';
import { TaskDto } from '../tasks/dto/task.dto';

/** global rest-api endpoint entry */
@ApiTags('Botlets')
@Controller('botlets')
export class RestApiController {
  constructor(
    protected readonly endpointsService: EndpointsService,
    protected readonly pluginsService: PluginsService,
    protected readonly authTokensService: AuthTokensService,
  ) {}

  @ApiOperation({
    description: 'Botlet receiver endpoint entry for rest-api.',
  })
  @All(':endpointUuid/api')
  async receiverEntry(@Req() req, @Param('endpointUuid') uuid: string) {
    return this.endpointsService.receive(uuid, req);
  }

  /**
   * 1. push(task): {
   * 2. mapping,
   * 3. progressive param, ? manual/ai?
   * 4. auth, invoke,-> }
   * 5. reply -> confirm task
   */
  @Post('reply/:authToken')
  async postReply(@Param('authToken') authToken: string, @Body() body: object) {
    // verify the authToken
    const caller: JwtPayload = await this.verifyAppToken(authToken);
    if (!caller) throw new UnauthorizedException();

    // return this.called(authToken, body);
  }

  /**
   *
   * 1. called: {
   * 2. verify
   * 3. convert ->
   * 4. create}
   * 5. respond to caller ->
   */
  async called(authToken: string, callerType: string, body: object) {
    // verify the authToken
    const caller: JwtPayload = await this.verifyAppToken(authToken);
    if (!caller) throw new UnauthorizedException();

    const dto = await this.convertToTask(callerType, body, caller);
    if (!dto?.botletUuid)
      throw new BadRequestException('botlet uuid is missing');

    const [task] = await this.tasksService.create(dto);

    // TODO instant syncResult to respond
    return task;
  }

  /** jwt with aud == 'authToken' */
  async verifyAppToken(authToken: string) {
    const payload: JwtPayload = await this.authTokensService.verify(
      authToken,
      'API_KEY',
    );
    return payload;
  }

  /** implementation for postmarkapp.com */
  async convertToTask(
    callerType: string,
    body: object,
    caller: JwtPayload,
  ): Promise<TaskDto & { callerType: string; createdBy: string }> {
    const plugin: CallerPlugin = this.pluginsService.getPlugin(callerType);
    if (!plugin?.convertToTask)
      throw new BadRequestException(
        `plugin callerType=${callerType} not found`,
      );

    const task: TaskDto = await plugin.convertToTask(callerType, body, caller);
    if (!task) return;

    return { ...task, callerType, createdBy: caller.sub };
  }
}
