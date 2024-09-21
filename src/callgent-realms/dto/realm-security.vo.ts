/**
 * Reference properties to realm-scheme.
 * multiple realms with and-relation
 */
export class RealmSecurityVO {
  [realmPk: string]: RealmSecurityItem;
}

export class RealmSecurityItem {
  realmPk: number;

  /** scopes for the security operation */
  scopes?: string[];

  /** whether to attach token to request, or validate token separately */
  attach?: boolean;
}
