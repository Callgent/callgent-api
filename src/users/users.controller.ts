import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtGuard } from '../infra/auth/jwt/jwt.guard';
import { RestApiResponse } from '../restapi/response.interface';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import { ConfigService } from '@nestjs/config';
import { AuthUtils } from '../infra/auth/auth.utils';

@ApiTags('Users')
@ApiBearerAuth('defaultBearerAuth')
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
}
