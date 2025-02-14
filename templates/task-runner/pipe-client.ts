import * as net from 'net';
import path from 'path';

interface PendingRequest {
  resolve: (value: string) => void;
  reject: (reason?: any) => void;
}

export class PipeClient {
  private client: net.Socket;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private isConnected: boolean = false;
  private shutdown: boolean = false;
  private nextRequestId: number = 0; // decremented for each request
  private connectionWaiters: (() => void)[] = [];

  constructor(
    private readonly pipePath: string,
    private readonly cmdPrefix: string,
    /** prefixed on requestId */
    private readonly requestPrefix: string,
    private readonly logger: Console,
    private readonly heartbeatInterval: number = 1000,
  ) {
    this.client = new net.Socket();
  }

  init() {
    this.shutdown = false;
    return this.connect();
  }

  private connect() {
    return new Promise<void>((resolve, reject) => {
      if (this.shutdown) return this.logger.log('Client is shutdown');

      this.client.connect(this.pipePath, () => {
        this.logger.log('Connecting to the pipe');
        this.isConnected = true;
        resolve();
        this.connectionWaiters.forEach((resolve) => resolve());
        this.connectionWaiters = [];
        this.startHeartbeat();
      });

      this.client.on('data', (data) => {
        const response = data.toString();
        const [cmdPrefix, requestId, ...fullResponse] = response.split('|');
        if (cmdPrefix != this.cmdPrefix) return;

        const pendingRequest = this.pendingRequests.get(requestId);
        if (pendingRequest) {
          pendingRequest.resolve(fullResponse.join('|'));
          this.pendingRequests.delete(requestId);
        } else {
          this.logger.log('Error: Unexpected requestId ignored: ' + requestId);
        }
      });

      this.client.on('error', (err) => {
        this.logger.log('Error: Pipe client error:', err);
        reject(err);
        this.reconnect();
      });

      this.client.on('close', () => {
        this.logger.log('Pipe client closed');
        this.isConnected = false;
        this.reconnect();
      });
    });
  }

  private async waitForConnection(requestId: string): Promise<void> {
    if (this.isConnected) return;
    this.logger.log('Waiting for connection...', requestId);
    return new Promise<void>((resolve) => {
      this.connectionWaiters.push(resolve);
    });
  }

  private reconnect(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.logger.log('Reconnecting...');
    setTimeout(() => {
      this.client.destroy();
      this.client = new net.Socket();
      this.connect();
    }, this.heartbeatInterval * 2);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer && clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.isConnected &&
        this.client.write('ping\n', 'utf8', (err) => {
          if (err) {
            this.logger.log('Error: Heartbeat failed:', err);
            this.reconnect();
          }
        });
    }, this.heartbeatInterval);
  }

  /** command format: `${cmdPrefix}|${requestId}|${cmd}` */
  public async sendCommand(cmd: string): Promise<string> {
    const requestId = this.requestPrefix + ':' + --this.nextRequestId;

    await this.waitForConnection(requestId);
    const request = `${this.cmdPrefix}|${requestId}|${cmd}\n`;

    return new Promise<string>((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      this.client.write(request, 'utf8', (err) => {
        if (err) {
          this.pendingRequests.delete(requestId);
          reject(err);
        }
      });
      this.logger.log(`Command sent: ${requestId}`);
    });
  }

  /**
   * @param code exit code: 0 for success, >0 for error
   * @param args
   */
  public async sendResult(code: number, ...args: any[]) {
    const resultKey = this.requestPrefix + ':' + code;
    await this.waitForConnection(resultKey);
    const result = JSON.stringify(
      args.map(
        (arg) =>
          (Object.prototype.toString.call(arg) === '[object Error]' &&
            (arg.stack || arg.message)) ||
          arg,
      ),
    );
    const request = `${this.cmdPrefix}|${resultKey}|${result}\n`;
    this.client.write(request, 'utf8', (err) => {
      if (err) throw err;
    });
    this.logger.debug('Result sent:', code, result);
  }

  public close(): void {
    this.shutdown = true;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.client.destroy();
  }
}
