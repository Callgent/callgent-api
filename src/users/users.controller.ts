import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { AuthUtils } from '../infra/auth/auth.utils';
import { JwtGuard } from '../infra/auth/jwt/jwt.guard';
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
    const uuid = req.user?.sub;
    if (!uuid) return { data: null };

    const user = await this.userService.findOne(uuid);
    const token = user
      ? req.headers.authorization?.split(' ')[1] ||
        req.cookies[AuthUtils.getAuthCookieName(this.configService)]
      : undefined;

    return { data: user, meta: { token } };
  }

  @ApiOperation({
    summary: 'Reset password by sending validation email with reset url',
  })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { type: 'boolean' } } },
      ],
    },
  })
  @Post('confirm-email/request')
  async sendConfirmEmail(@Body() vo: ValidationEmailVo) {
    const sent = await this.userService.sendValidationEmail(vo);

    return { data: sent };
  }

  @Post('confirm-email')
  async confirmEmail(@Body() vo: ValidationEmailVo) {
    // const user = await this.userService.findOne(uuid);
    // const token = user
    //   ? req.headers.authorization?.split(' ')[1] ||
    //     req.cookies[AuthUtils.getAuthCookieName(this.configService)]
    //   : undefined;
    // return { data: user, meta: { token } };
  }
}
