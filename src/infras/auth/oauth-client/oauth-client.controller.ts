import { CacheTTL } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';
import { InjectOAuth, OAuthService } from 'nestjs-oauth2';
import { InjectOAuthStateService } from 'nestjs-oauth2/dist/state/state.decorators';
import { StateService } from 'nestjs-oauth2/dist/state/state.service';
import { AuthUtils } from '../auth.utils';
import { AuthLoginEvent } from '../events/auth-login.event';
import { AuthLoginedEvent } from '../events/auth-logined.event';
import { JwtAuthService } from '../jwt/jwt.service';

/** oauth for root user */
@CacheTTL(-1)
@ApiTags('Authentication')
@Controller('auth')
export class OAuthClientController {
  private readonly logger = new Logger(OAuthClientController.name);

  constructor(
    protected readonly configService: ConfigService,
    protected readonly jwtService: JwtAuthService,
    protected readonly eventEmitter: EventEmitter2,
    @InjectOAuth() protected readonly oauthService: OAuthService,
    @InjectOAuthStateService() protected readonly stateService: StateService,
  ) {}

  @ApiParam({
    name: 'provider',
    description: 'oauth authentication from the given provider',
    examples: { github: { value: 'github' }, google: { value: 'google' } },
  })
  @ApiParam({
    name: 'successUri',
    required: false,
    description: 'redirect uri when auth success, if specified',
  })
  @ApiResponse({ status: 302, description: 'redirect to OAuth server.' })
  @Get(':provider')
  async oauthStart(
    @Param('provider') provider: string,
    @Res() res: FastifyReply,
    @Query('successUri') successUri?: string,
  ) {
    let { state } = await this.stateService.create();
    state += '@' + (successUri || '');
    res
      .status(302)
      .redirect(this.oauthService.with(provider).getAuthorizeUrl({ state }));
  }

  @ApiParam({
    name: 'provider',
    examples: { github: { value: 'github' }, google: { value: 'google' } },
  })
  @ApiResponse({
    schema: {
      properties: {
        token: { type: 'string', example: 'bearer-token-string' },
      },
    },
  })
  @Get('callback/:provider')
  async oauthCallback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') states: string,
    @Res() res: FastifyReply,
  ) {
    const [state, successUri] = states?.split('@') || [];
    // FIXME: stateService.verify() always returns true, replace: OAUTH_STATE_SERVICE
    const verified = await this.stateService.verify(state);
    if (!verified) {
      throw new BadRequestException('Invalid state');
    }
    const accessToken = await this.oauthService.with(provider).getAccessToken({
      code,
    });
    const [user] = await this.eventEmitter.emitAsync(
      AuthLoginEvent.eventName,
      new AuthLoginEvent('oauth', provider, accessToken),
    );
    if (!user) {
      throw new BadRequestException(
        `Invalid oauth token for provider: ${provider}`,
      );
    }
    await this.eventEmitter.emitAsync(
      AuthLoginedEvent.eventName,
      new AuthLoginedEvent(user),
    );

    const token = this.jwtService.sign(user);
    const cookieValue = AuthUtils.genAuthCookie(token, this.configService);
    if (cookieValue) res.header('Set-Cookie', cookieValue);
    // if redirect w/o cookie, token lost by intention, token must not be redirected
    if (successUri) res.status(302).redirect(successUri);
    else res.send({ data: token });
  }
}
