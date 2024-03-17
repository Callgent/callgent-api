import { IPlugin } from './plugin';

/** adaptor to send task as request to receiver */
export interface ReceiverPlugin extends IPlugin {
  invoke();
  reply();
}
