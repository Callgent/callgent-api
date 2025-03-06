import {
  OAuthFlowsObject,
  SecuritySchemeObject,
  SecuritySchemeType,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

export type AuthType = SecuritySchemeType | 'password' | 'jwt'; // | '';
const authTypes: AuthType[] = [
  'apiKey',
  'http',
  'oauth2',
  'openIdConnect',
  'apiKey',
  'password',
];

export function isAuthType(t: string): t is AuthType {
  return authTypes.includes(t as AuthType);
}
/**
 * realm.scheme
 * @see SecuritySchemeObject https://swagger.io/specification/#security-scheme-object
 */
export class RealmSchemeVO {
  /** whether issuing tokens per user */
  perUser?: boolean;
  description?: string;

  /** token validation url, must not empty */
  validationUrl: string;

  // apiKey/jwt
  name?: string;
  in?: string;
  // http
  scheme?: string;
  bearerFormat?: string;
  // oauth2
  flows?: OAuthFlowsObject;
  // openIdConnect
  openIdConnectUrl?: string;
}

/**
 * #/definitions/APIKeySecurityScheme
 * @see https://github.com/OAI/OpenAPI-Specification/blob/main/schemas/v3.0/schema.json
 */
export interface APIKeySecurityScheme {
  type: 'apiKey';
  name: string;
  in: 'header' | 'query' | 'cookie';
  description?: string;
  [key: `x-${string}`]: any;
}
