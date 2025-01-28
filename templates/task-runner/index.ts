import fs from 'fs';
import fsPromise from 'fs/promises';
import { default as TaskRunner } from './main';
import { PipeClient } from './pipe-client';
import purposes from './purposes.json';

// - add `invokeService` method
// - manage resumingStates
// - error fixing and retrying
class ExtendedTaskRunner extends TaskRunner {
  declare resumingStates: any;
  private readonly resumingStatesFile = './resumingStates.json';
  public readonly _pipeClient: PipeClient;
  private readonly _pipePath = './pipe.socket';
  private readonly _logFile = './task.log';
  private readonly _originalConsole: Console;
  private readonly _executionId: string;

  constructor(private readonly cmdPrefix: string) {
    super();
    this._executionId = this._intToBase64(1e7 * Math.random());
    this._originalConsole = { ...console };

    this._pipeClient = new PipeClient(
      this._pipePath,
      cmdPrefix,
      this._executionId,
      this._originalConsole,
    );
  }

  async init() {
    await Promise.all([
      this._loadResumingStates(),
      this._pipeClient.init(),
      this._redirectLogs2File(),
    ]);
    console.log(
      `Starting task#${this._executionId} with prefix: ${this.cmdPrefix}`,
    );
  }

  async invokeService(
    purposeKey: string,
    args: { parameters?: { [paramName: string]: any }; requestBody?: any },
  ) {
    console.info(`Invoking service: ${purposeKey}`);

    const epName = purposes.find((p) => p.purposeKey === purposeKey)?.epName;
    if (!epName) throw new Error(`Invalid purposeKey: ${purposeKey}`);

    const r = await this._pipeClient.sendCommand(
      JSON.stringify({ epName, args }),
    );
    try {
      return JSON.parse(r);
    } catch (e) {
      console.warn('Failed to parse response from service: ' + r, e);
      return r;
    }
  }

  async _loadResumingStates() {
    if (!('resumingStates' in this) || !fs.existsSync(this.resumingStatesFile))
      return;
    try {
      const j = await fsPromise.readFile(this.resumingStatesFile);
      this.resumingStates = JSON.parse(j.toString());
    } catch (e) {
      console.error('Failed to load resumingStates.json, ignored', e);
      fs.unlinkSync(this.resumingStatesFile);
    }
  }

  _saveResumingStates() {
    if (!this.resumingStates) return;
    try {
      fs.writeFileSync(
        this.resumingStatesFile,
        JSON.stringify(this.resumingStates),
      );
    } catch (e) {
      console.error('Failed to save resumingStates.json, ignored', e);
    }
  }

  private _redirectLogs2File() {
    // console.debug = function (...args: any[]) {};
    console.log = (...args: any[]) =>
      this._write2Log('log', this._executionId, args);
    console.info = (...args: any[]) =>
      this._write2Log('info', this._executionId, args);
    console.warn = (...args: any[]) =>
      this._write2Log('warn', this._executionId, args);
    console.error = (...args: any[]) =>
      this._write2Log('error', this._executionId, args);
    return fsPromise.unlink(this._logFile);
  }

  private _write2Log(logLevel: string, executionId: string, logs: any[]) {
    // error into string
    logs = logs.map(
      (log) =>
        (Object.prototype.toString.call(log) === '[object Error]' &&
          (log.stack || log.message)) ||
        log,
    );
    const time = new Date().toISOString().substring(11, 23); // hh:mm:ss.SSS
    const line = `${time} [${logLevel}] ${JSON.stringify(logs)}`;
    fs.appendFile(this._logFile, line + '\n', (err) => {});
  }

  private _intToBase64(num: number) {
    const urlAlphabet =
      'RoLI6m-2WvwVuHdNT1XZblqUDBtseKQAfgan83Myzric7EhjC5pxJSF_G9YO40Pk';
    if (num === 0) return '0';
    let result = '';
    while (num > 0) {
      result = urlAlphabet[num & 63] + result;
      num >>>= 6;
    }
    return result;
  }
}

(async () => {
  const cmdPrefix = process.argv[2];

  // FIXME: restrict allowed directory
  // const allowedDirectory = __dirname;

  const taskRunner = new ExtendedTaskRunner(cmdPrefix);
  await taskRunner.init();
  taskRunner
    .execute()
    .then((result: any) => {
      if (!result) return;
      const response = JSON.stringify(result);
      taskRunner._pipeClient.sendResult(0, response);
    })
    .catch((err) => {
      taskRunner._pipeClient.sendResult(1, err);
      throw err;
    })
    .finally(() => {
      taskRunner._saveResumingStates();
      taskRunner._pipeClient?.close();
      console.info('Task runner finished');
    });
})();
