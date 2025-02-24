import {
  ApiExtraModels,
  ApiProperty,
  ApiResponseProperty,
} from '@nestjs/swagger';

export class RealmSecurityItem {
  realmPk: number;

  /** scopes for the security operation */
  @ApiProperty({ isArray: true, required: false, type: 'string' })
  scopes?: string[];

  /** whether to attach token to request, or validate token separately */
  @ApiResponseProperty({ type: 'boolean' })
  attach?: boolean;
}

export class RealmSecurityItemForm {
  @ApiProperty({ required: true, type: 'string' })
  realmKey: string;

  /** scopes for the security operation */
  @ApiProperty({ isArray: true, required: false, type: 'string' })
  scopes?: string[];
}

/**
 * Reference properties to realm-scheme.
 * multiple realms with and-relation
 */
@ApiExtraModels(RealmSecurityItem)
export class RealmSecurityVO {
  [realmPk: string]: RealmSecurityItem;
}
