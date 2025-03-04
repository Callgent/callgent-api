import { CacheTTL } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCreatedResponse, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { JwtAuthService } from '../infras/auth/jwt/jwt-auth.service';
import { LocalAuthController } from '../infras/auth/local/local-auth.controller';
import { RestApiResponse } from '../restapi/response.interface';
import { CreateUserIdentityDto } from '../user-identities/dto/create-user-identity.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@CacheTTL(0)
@ApiTags('Authentication')
@Controller('auth')
export class AuthController extends LocalAuthController {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly jwtService: JwtAuthService,
    protected readonly userService: UsersService,
  ) {
    super(configService, jwtService);
  }

  @ApiCreatedResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        {
          properties: {
            data: { $ref: getSchemaPath(UpdateUserDto) },
            meta: {
              properties: {
                token: {
                  type: 'string',
                  description: 'jwt token',
                },
              },
            },
          },
        },
      ],
    },
  })
  @Post('register')
  async register(@Body() dto: CreateUserIdentityDto) {
    const { user } = await this.userService.registerUserFromIdentity({
      ...dto,
      uid: dto.email,
      provider: 'local',
      authType: 'password',
    });
    const token = this.jwtService.sign({
      tenantPk: user.tenantPk,
      id: user.pk,
      sub: user.id,
      iss: dto.provider,
      aud: user.id,
    });
    return {
      data: {
        ...user,
        tenant: undefined,
        id: undefined,
        tenantPk: undefined,
        deletedAt: undefined,
      },
      meta: { token },
    };
  }

  /** oauth2 credentials auth */
  @Post('tokens')
  @HttpCode(HttpStatus.OK)
  async getTokenByOauth2Credentials(
    @Body()
    {
      grant_type,
      client_id,
      client_secret,
    }: {
      grant_type: string;
      client_id: string;
      client_secret: string;
    },
  ) {
    if (grant_type !== 'client_credentials')
      throw new BadRequestException('Unsupported grant type ' + grant_type);

    const cid = this.configService.get('EMAIL_SPARKPOST_RELAY_CLIENT_ID');
    const pwd = this.configService.get('EMAIL_SPARKPOST_RELAY_CLIENT_SECRET');
    if (cid !== client_id || pwd !== client_secret)
      throw new UnauthorizedException('Invalid credentials');

    const expires_in = parseInt(
      this.configService.get('EMAIL_SPARKPOST_RELAY_EXPIRES_IN'),
    );
    return {
      access_token: this.jwtService.sign({
        sub: cid,
        iss: 'sparkpost-relay',
        aud: 'sparkpost-relay',
      }),
      token_type: 'Bearer',
      expires_in,
    };
  }
}
