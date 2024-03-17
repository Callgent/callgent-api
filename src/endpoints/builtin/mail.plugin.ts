import { Injectable } from '@nestjs/common';
import { ReceiverPlugin } from '../receiver.plugin';

/**
 * need to config an receiver mail address for the botlet.
 */
@Injectable()
export class MailPlugin4Postmark implements ReceiverPlugin {
  pluginType() {
    return 'mail';
  }

  invoke() {
    throw new Error('Method not implemented.');
  }

  reply() {
    throw new Error('Method not implemented.');
  }
}
