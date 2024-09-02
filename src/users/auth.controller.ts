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
import { ApiOkResponse, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { JwtAuthService } from '../infra/auth/jwt/jwt.service';
import { LocalAuthController } from '../infra/auth/local/local-auth.controller';
import { RestApiResponse } from '../restapi/response.interface';
import { CreateUserIdentityDto } from '../user-identities/dto/create-user-identity.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@CacheTTL(0)
@ApiTags('authentication')
@Controller('auth')
export class AuthController extends LocalAuthController {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly jwtService: JwtAuthService,
    protected readonly userService: UsersService,
  ) {
    super(configService, jwtService);
  }

  @ApiOkResponse({
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
    dto.provider = 'local';
    dto.uid = dto.email;
    const ui = await this.userService.registerUserFromIdentity(dto);
    const user = ui.user;
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
      username,
      password,
    }: {
      grant_type: string;
      username: string;
      password: string;
    },
  ) {
    if (grant_type !== 'client_credentials')
      throw new BadRequestException('Unsupported grant type ' + grant_type);

    const user = this.configService.get('EMAIL_SPARKPOST_RELAY_CLIENT_ID');
    const pwd = this.configService.get('EMAIL_SPARKPOST_RELAY_CLIENT_SECRET');
    if (user !== username || pwd !== password)
      throw new UnauthorizedException('Invalid credentials');

    const expires_in = parseInt(
      this.configService.get('EMAIL_SPARKPOST_RELAY_EXPIRES_IN'),
    );
    return {
      access_token: this.jwtService.sign({
        sub: user,
        iss: 'sparkpost-relay',
        aud: 'sparkpost-relay',
      }),
      token_type: 'Bearer',
      expires_in,
    };
  }
}
