/**
 * listener must return the user payload to be used in security context or jwt
 */
export class AuthLoginEvent {
  public static readonly eventName = 'auth.login' as const;

  constructor(
    public readonly authType: 'password' | 'oauth',
    public readonly provider: string,
    public readonly credentials: any,
    public readonly username?: string,
    public readonly request?: any,
    public readonly userId?: string,
    public readonly moreInfo?: any,
  ) {}
}
