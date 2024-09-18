import {
  OAuthFlowsObject,
  SecuritySchemeObject,
  SecuritySchemeType,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

export class RealmSchemeVO implements SecuritySchemeObject {
  /** whether issuing tokens per user */
  perUser?: boolean;

  /** token validation url, empty means attaching to request to validate */
  validationUrl?: string;

  type: SecuritySchemeType;
  description?: string;
  name?: string;
  in?: string;
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlowsObject;
  openIdConnectUrl?: string;
}
