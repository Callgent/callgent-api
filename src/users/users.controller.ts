import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { AuthUtils } from '../infra/auth/auth.utils';
import { JwtGuard } from '../infra/auth/jwt/jwt.guard';
import { JwtAuthService } from '../infra/auth/jwt/jwt.service';
import { RestApiResponse } from '../restapi/response.interface';
import { UpdateUserDto } from './dto/update-user.dto';
import { ValidationEmailVo } from './dto/validation-email.vo';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiSecurity('defaultBearerAuth')
@ApiExtraModels(UpdateUserDto)
@Controller('users')
export class UsersController {
  constructor(
    protected readonly userService: UsersService,
    protected readonly configService: ConfigService,
    protected readonly jwtService: JwtAuthService,
  ) {}

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
                  description: 'empty if not authenticated',
                },
              },
            },
          },
        },
      ],
    },
  })
  @UseGuards(new JwtGuard(true))
  @Get('info')
  async findOne(@Req() req) {
    const id = req.user?.sub;
    if (!id) return { data: null };

    const user = await this.userService.findOne(id);
    const token = user
      ? req.headers.authorization?.split(' ')[1] ||
        req.cookies[AuthUtils.getAuthCookieName(this.configService)]
      : undefined;

    return { data: user, meta: { token } };
  }

  @ApiOperation({
    summary: 'Reset password by sending validation email with reset url',
  })
  @ApiCreatedResponse({
    schema: {
      anyOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { type: 'boolean' } } },
      ],
    },
  })
  @UseGuards(new JwtGuard(true))
  @Post('send-confirm-email')
  async sendConfirmEmail(@Body() vo: ValidationEmailVo, @Req() req) {
    const id = req.user?.sub;
    const sent = await this.userService.sendValidationEmail(vo, id);

    return { data: sent };
  }

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { type: 'string', description: 'jwt token' } } },
      ],
    },
  })
  @ApiConsumes('text/plain')
  @ApiBody({ required: false, description: 'pwd if reset', type: 'string' })
  @Patch('confirm-email/:token')
  async confirmEmail(
    @Res() res,
    @Param('token') token: string,
    @Body() pwd?: string,
  ) {
    const user = await this.userService.validateEmail(token, pwd);
    if (!user)
      throw new UnauthorizedException('Invalid or expired confirmation token');

    const jwt = this.jwtService.sign(user);
    const cookieValue = AuthUtils.genAuthCookie(jwt, this.configService);
    cookieValue && res.header('Set-Cookie', cookieValue);
    res.send({ data: jwt });
  }
}
