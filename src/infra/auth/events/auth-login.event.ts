/**
 * listener must return the user payload to be used in security context or jwt
 */
export class AuthLoginEvent {
  public static readonly eventName = 'auth.login' as const;

  /**
   * authType: bypass, no check, auth from request: UserDto
   */
  constructor(
    public readonly authType: 'password' | 'oauth' | 'bypass',
    public readonly provider: string,
    public readonly credentials: any,
    public readonly username?: string,
    public readonly request?: any,
    public readonly userId?: string,
    public readonly moreInfo?: any,
  ) {}
}
