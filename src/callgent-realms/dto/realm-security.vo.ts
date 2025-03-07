import {
  ApiExtraModels,
  ApiProperty,
  ApiResponseProperty,
} from '@nestjs/swagger';

export class RealmSecurityItemForm {
  @ApiProperty({ required: true, type: 'string' })
  realmId: string;

  /** scopes for the security operation */
  @ApiProperty({ isArray: true, required: false, type: 'string' })
  scopes?: string[];
}

/** item bound on entry/ep */
export class RealmSecurityItem {
  realmId: string;

  /** scopes for the security operation */
  @ApiProperty({ isArray: true, required: false, type: 'string' })
  scopes?: string[];

  /** whether to attach token to request, or validate token separately */
  @ApiResponseProperty({ type: 'boolean' })
  attach?: boolean;
}

/**
 * Reference properties to realm-scheme.
 * multiple realms with and-relation
 */
@ApiExtraModels(RealmSecurityItem)
export class RealmSecurityVO {
  [realmId: string]: RealmSecurityItem;
}
