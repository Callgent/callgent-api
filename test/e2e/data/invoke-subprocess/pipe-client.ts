import * as net from 'net';

interface PendingRequest {
  resolve: (value: string) => void;
  reject: (reason?: any) => void;
}

export class PipeClient {
  private client: net.Socket;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pendingRequests: Map<number, PendingRequest> = new Map();
  private isConnected: boolean = false;
  private nextRequestId: number = 1; // incremented for each request
  private connectionWaiters: (() => void)[] = [];

  constructor(
    private readonly pipePath: string,
    private readonly cmdPrefix: string,
    private readonly heartbeatInterval: number = 1000,
  ) {
    this.client = new net.Socket();
    this.connect();
  }

  private connect(): void {
    this.client.connect(this.pipePath, () => {
      console.log('Connected to the pipe');
      this.isConnected = true;
      this.connectionWaiters.forEach((resolve) => resolve());
      this.connectionWaiters = [];
      this.startHeartbeat();
    });

    this.client.on('data', (data) => {
      const response = data.toString();
      const [cmdPrefix, requestIdStr, ...fullResponse] = response.split('-');
      if (cmdPrefix != this.cmdPrefix) return;

      const requestId = parseInt(requestIdStr, 10);
      const pendingRequest = this.pendingRequests.get(requestId);
      if (pendingRequest) {
        pendingRequest.resolve(fullResponse.join('-'));
        this.pendingRequests.delete(requestId);
      }
    });

    this.client.on('error', (err) => {
      console.error('Pipe client error:', err);
      this.reconnect();
    });

    this.client.on('close', () => {
      console.log('Pipe client closed');
      this.isConnected = false;
      this.reconnect();
    });
  }

  private async waitForConnection(requestId: number): Promise<void> {
    if (this.isConnected) return;
    console.log('Waiting for connection...', requestId);
    return new Promise<void>((resolve) => {
      this.connectionWaiters.push(resolve);
    });
  }

  private reconnect(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    setTimeout(() => {
      this.client.destroy();
      this.client = new net.Socket();
      this.connect();
    }, this.heartbeatInterval * 2);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer && clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.sendCommand('ping').catch((err) => {
          this.reconnect();
        });
      }
    }, this.heartbeatInterval);
  }

  /** command format: `${this.cmdPrefix}-${requestId}-${cmd}` */
  public async sendCommand(cmd: string): Promise<string> {
    const requestId = this.nextRequestId++;

    await this.waitForConnection(requestId);
    const request = `${this.cmdPrefix}-${requestId}-${cmd}`;

    return new Promise<string>((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      this.client.write(request, (err) => {
        if (err) {
          this.pendingRequests.delete(requestId);
          reject(err);
        }
      });
      console.log(`Command sent: ${requestId}`);
    });
  }

  public close(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.client.destroy();
    this.isConnected = false;
  }
}
