import {
  OAuthFlowsObject,
  SecuritySchemeType,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

export type AuthType = SecuritySchemeType | 'password'; // | '';
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
 * @see SecuritySchemeObject
 */
export class RealmSchemeVO {
  /** whether issuing tokens per user */
  perUser?: boolean;

  /** service provider url */
  provider: string;
  /** token validation url, empty means attaching to request to validate */
  validationUrl?: string;

  type: AuthType;
  description?: string;
  name?: string;
  in?: string;
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlowsObject;
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
