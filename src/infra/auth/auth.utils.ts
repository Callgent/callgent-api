import { ConfigService } from '@nestjs/config';
import ms from 'ms';

export class AuthUtils {
  static genAuthCookie(jwtToken: string, configService: ConfigService) {
    const cookieName = configService.get('JWT_COOKIE_NAME');
    if (!cookieName) return;

    const siteRootDomain = configService.get<string>('SITE_ROOT_DOMAIN');
    const jwtExpiresIn = configService.get<string>('JWT_EXPIRES_IN');
    const maxAge = Math.floor(ms(jwtExpiresIn));
    const secure = configService
      .get<string>('NODE_ENV', 'dev')
      .toLowerCase()
      .startsWith('dev')
      ? ''
      : 'Secure;';
    const HttpOnly = configService.get<string>('NOT_HTTP_ONLY')
      ? ''
      : 'HttpOnly;';
    return `${cookieName}=${jwtToken}; ${HttpOnly} ${secure} Path=/; SameSite=Strict; Domain=.${siteRootDomain}; Max-Age=${maxAge};`;
  }

  /** @returns empty means no jwt cookie */
  static getAuthCookieName(configService: ConfigService) {
    return configService.get<string>('JWT_COOKIE_NAME');
  }
}
