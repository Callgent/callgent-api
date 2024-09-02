import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthService } from '../infra/auth/jwt/jwt.service';
import { EmailsService } from './emails.service';
import { EmailRelayObject } from './dto/sparkpost-relay-object.interface';

@Controller('emails')
export class EmailsController {
  constructor(
    private readonly jwtAuthService: JwtAuthService,
    private readonly configService: ConfigService,
    private readonly emailsService: EmailsService,
  ) {}

  /** @see https://developers.sparkpost.com/api/relay-webhooks/ */
  @HttpCode(HttpStatus.OK)
  @Post('relay/spark-post')
  async handleRelayEvent(
    @Headers('Authorization') authorization: string,
    @Body() relays: EmailRelayObject[],
  ) {
    const { sub } = this.jwtAuthService.verify(authorization?.substring(7));
    if (sub !== this.configService.get('EMAIL_SPARKPOST_RELAY_CLIENT_ID'))
      throw new BadRequestException('Invalid Client ID');

    // handle relay event
    relays?.forEach((relay) =>
      this.emailsService.handleRelayMessage(relay.msys.relay_message),
    );
    return; // return 200 to consume the event
  }
}