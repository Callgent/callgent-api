import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';

export class RealmSecurityItem {
  @ApiProperty({
    type: 'integer',
    format: 'int32',
    required: true,
  })
  realmPk: number;

  /** scopes for the security operation */
  @ApiProperty({ isArray: true, required: false, type: 'string' })
  scopes?: string[];

  /** whether to attach token to request, or validate token separately */
  @ApiProperty({ type: 'boolean', required: false })
  attach?: boolean;
}

/**
 * Reference properties to realm-scheme.
 * multiple realms with and-relation
 */
@ApiExtraModels(RealmSecurityItem)
export class RealmSecurityVO {
  [realmPk: string]: RealmSecurityItem;
}
