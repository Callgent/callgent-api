import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, spawnSync, SpawnSyncReturns } from 'child_process';
import fs from 'fs';
import net from 'net';
import path from 'path';
import readline from 'readline';
import { Utils } from '../infras/libs/utils';

@Injectable()
export class InvokeSubprocess {
  private readonly logger = new Logger(InvokeSubprocess.name);
  constructor(private readonly configService: ConfigService) {
    this.subprocessEnv = {
      TZ: this.configService.get('TZ'),
      PATH: this.configService.get('PATH'),
    };
  }
  private readonly subprocessEnv: NodeJS.ProcessEnv;

  private _getCheckpointPath(cwd: string): string {
    return path.join(cwd, 'checkpoint');
  }

  /**
   * spawn a subprocess, or restore the frozen one if checkpoint exists
   */
  async spawnOrRestore(cmd: string, args: string[], { cwd }: { cwd: string }) {
    let child: { pid: number };

    // restore subprocess
    child = this.restoreProcess(this._getCheckpointPath(cwd));
    if (child) return child;

    // start subprocess
    return new Promise<{ pid: number }>((resolve, reject) => {
      const p = spawn(cmd, args, {
        cwd,
        env: this.subprocessEnv,
      });

      const f = (d) => {
        this.logger.log('Subprocess std output: %s', d);
        resolve(p as { pid: number });
      };
      p.stdout.on('data', f);
      p.stderr.on('data', f);
      p.on('close', f);
      p.on('error', reject);
    });
  }

  /**
   * @returns exit code, null if not applicable
   */
  async waitForExit(child: { pid: number; on?: any }) {
    return new Promise<number | null>((resolve, reject) => {
      if (child.on) {
        child.on('spawn', () =>
          this.logger.log('Subprocess started with pid %d', child.pid),
        );
        child.on('exit', (code: number) => {
          this.logger.log('Subprocess exited with code %d', code);
          resolve(code);
        });
        child.on('error', reject);
      } else {
        const checkInterval = 500;
        const checkProcess = () => {
          try {
            process.kill(child.pid, 0);
            setTimeout(checkProcess, checkInterval);
          } catch (err) {
            if (err.code === 'ESRCH') {
              const code = this._getExitCodeForLinux(child.pid);
              this.logger.log('Subprocess exited with code %d', code);
              resolve(code);
            } else {
              reject(err);
            }
          }
        };
        checkProcess();
      }
    });
  }

  private async _getExitCodeForLinux(pid: number): Promise<number | null> {
    const statusPath = `/proc/${pid}/status`;
    try {
      const status = fs.readFileSync(statusPath, 'utf-8');
      const match = status.match(/ExitCode:\s+(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    } catch (err) {
      return null;
    }
  }

  restoreProcess(cwd: string) {
    const checkpointPath = this._getCheckpointPath(cwd);
    if (!fs.existsSync(checkpointPath)) return;

    const pidFilePath = path.join(cwd, 'restore.pid');
    if (fs.existsSync(pidFilePath)) fs.unlinkSync(pidFilePath);

    const p = spawnSync(
      'criu',
      [
        'restore',
        '-D',
        checkpointPath,
        '--shell-job',
        '--pidfile',
        pidFilePath,
      ],
      {
        cwd,
        env: this.subprocessEnv,
      },
    );

    if (p.status == 0) {
      if (!fs.existsSync(pidFilePath))
        throw new Error('restore.pid not found, restore failed');
      const pid = parseInt(fs.readFileSync(pidFilePath, 'utf8'), 10);
      if (!(pid > 0)) throw new Error('restore pid failed,' + pid);

      this.logger.log('Subprocess restored with pid %d', pid);
      return { pid };
    }

    throw new Error(
      'restore subprocess failed with code' + this._printProcessError(p),
    );
  }
  private _printProcessError(p: SpawnSyncReturns<Buffer>) {
    return `${p.status}: ${p.error?.message || p.stderr.toString('utf8')}`;
  }

  /**
   * frozen process is killed with SIGKILL(9), so exit code should be 128 + 9 = 137
   *
   * @throws Error if criu exit code is not 0, or failing to kill frozen subprocess
   */
  freezeProcess(child: { pid: number }, cwd: string) {
    const checkpointPath = this._getCheckpointPath(cwd);
    this.logger.log('Freeze and save process checkpoint...');
    const pc = spawnSync(
      'criu',
      ['dump', '-D', checkpointPath, '-t', child.pid.toString(), '--shell-job'],
      { cwd },
    );
    const pf = spawnSync('kill', ['-9', child.pid.toString()]); // send SIGKILL
    if (pc.status || pf.status)
      throw new Error(
        (pc.status ? 'criu dump' : 'Kill frozen subprocess') +
          ' failed with code' +
          this._printProcessError(pc.status ? pc : pf),
      );
    this.logger.log('Freeze process checkpoint saved');
  }

  /** create a named pipe, waiting for subprocess messages */
  async createNamedPipe(
    pipePath: string,
    {
      onLine,
      onConnect,
    }: {
      /**
       * to receive cmd/log/response/error from client, `prefix|executionId:code|result`, where:
       * - code < 0: client command to server, waiting for server reply
       * - code >= 0: client response(code=0), or error(code>0) to server, need not reply
       */
      onLine: (line: string, socket: net.Socket) => void;
      onConnect?: (socket: net.Socket) => void;
    },
  ) {
    const server = await this._createNamedPipeServer(pipePath);
    server.on('connection', (socket) => {
      this.logger.log('Subprocess connected to named pipe');
      onConnect && onConnect(socket);

      const rl = readline.createInterface({
        input: socket,
        terminal: false,
      });
      rl.on('line', (line) => onLine(line, socket));

      socket.on('error', (err) => this.logger.error('Pipe error:', err));
      socket.on('close', () => this.logger.log('Pipe closed'));
    });

    return server;
  }

  private async _createNamedPipeServer(pipePath: string) {
    for (;;) {
      try {
        const server = await new Promise<net.Server>((resolve, reject) => {
          fs.existsSync(pipePath) && fs.unlinkSync(pipePath);
          const server = net.createServer();
          server.listen(pipePath, () => {
            this.logger.log('Named pipe is listen on %s', pipePath);
            resolve(server);
          });
          server.on('error', reject);
        });
        return server;
      } catch (err) {
        this.logger.error(`Failed to create Named pipe server`, err);
        await Utils.sleep(1000);
      }
    }
  }
}
