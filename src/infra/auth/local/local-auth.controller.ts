import { Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiCreatedResponse } from '@nestjs/swagger';
import { AuthUtils } from '../auth.utils';
import { JwtAuthService } from '../jwt/jwt.service';
import { LocalAuthGuard } from './local-auth.guard';

// @ApiTags('authentication')
// @Controller('auth')
export class LocalAuthController {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly jwtService: JwtAuthService,
  ) {}

  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string' },
        password: { type: 'string', format: 'password' },
      },
      required: ['u', 'p'],
    },
  })
  @ApiCreatedResponse({
    schema: {
      properties: { data: { type: 'string', example: 'bearer-token-string' } },
    },
  })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req, @Res() res) {
    // issue token after login guard
    // return user with token
    const token = this.jwtService.sign(req.user);
    const cookieValue = AuthUtils.genAuthCookie(token, this.configService);
    cookieValue && res.header('Set-Cookie', cookieValue);
    res.send({ data: token });
  }
}
