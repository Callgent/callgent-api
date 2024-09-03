import { RelayEmail } from '../dto/sparkpost-relay-object.interface';
import { EmailRelayKey } from '../emails.service';

export class EmailRelayEvent {
  public static readonly eventPrefix = 'email.relay.' as const;

  constructor(
    public readonly relayKey: EmailRelayKey,
    public readonly relayId: string,
    public readonly email: RelayEmail,
  ) {}
}
