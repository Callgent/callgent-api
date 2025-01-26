import * as fs from 'fs';
import { default as TaskRunner } from './main';
import { PipeClient } from './pipe-client';
import purposes from './purposes.json';

// - add `invokeService` method
// - manage resumingStates
// - error fixing and retrying
class ExtendedTaskRunner extends TaskRunner {
  declare resumingStates: any;
  public readonly pipeClient: PipeClient;
  private readonly resumingStatesFile = './resumingStates.json';

  constructor(
    cmdPrefix: string,
    executionId: string,
    originalConsole: Console,
  ) {
    super();
    this.pipeClient = new PipeClient(
      './pipe.socket',
      cmdPrefix,
      executionId,
      originalConsole,
    );
    this.loadResumingStates();
  }

  async init() {
    await this.pipeClient.init();
  }

  async invokeService(
    purposeKey: string,
    args: { parameters?: { [paramName: string]: any }; requestBody?: any },
  ) {
    const epName = purposes.find((p) => p.purposeKey === purposeKey)?.epName;
    if (!epName) throw new Error(`Invalid purposeKey: ${purposeKey}`);

    const r = await this.pipeClient.sendCommand(
      JSON.stringify({ epName, args }),
    );
    try {
      return JSON.parse(r);
    } catch (e) {
      console.warn('Failed to parse response from pipe client', e);
      return r;
    }
  }

  loadResumingStates() {
    if (!('resumingStates' in this) || !fs.existsSync(this.resumingStatesFile))
      return;
    try {
      const j = fs.readFileSync(this.resumingStatesFile);
      this.resumingStates = JSON.parse(j.toString());
    } catch (e) {
      console.error('Failed to load resumingStates.json, ignored', e);
      fs.unlinkSync(this.resumingStatesFile);
    }
  }

  saveResumingStates() {
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
}

const urlAlphabet =
  'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';
function intToBase64(num: number) {
  if (num === 0) return '0';
  let result = '';
  while (num > 0) {
    result = urlAlphabet[num & 63] + result;
    num >>>= 6;
  }
  return result;
}

(async () => {
  const cmdPrefix = process.argv[2];
  const executionId = intToBase64(~~(1e7 * Math.random()));
  console.log(`Starting task#${executionId} with prefix: ${cmdPrefix}`);

  // FIXME: restrict allowed directory
  // const allowedDirectory = __dirname;

  // redirect console to pipeClient
  const originalConsole = { ...console };

  const taskRunner = new ExtendedTaskRunner(
    cmdPrefix,
    executionId,
    originalConsole,
  );
  await taskRunner.init();

  // console.log = function (...args: any[]) {
  //   taskRunner.pipeClient.sendResult('log', ...args);
  // };
  // console.debug = function (...args: any[]) {
  //   taskRunner.pipeClient.sendResult('debug', ...args);
  // };
  console.info = function (...args: any[]) {
    taskRunner.pipeClient.sendResult('info', ...args);
  };
  console.warn = function (...args: any[]) {
    taskRunner.pipeClient.sendResult('warn', ...args);
  };
  console.error = function (...args: any[]) {
    taskRunner.pipeClient.sendResult('error', ...args);
  };

  taskRunner
    .execute()
    .then((result: any) => {
      if (!result) return;
      const response = JSON.stringify(result);
      taskRunner.pipeClient.sendResult(0, response);
    })
    .catch((err) => {
      const msg = err.stack || err.message || err.toString();
      taskRunner.pipeClient.sendResult(1, msg);
      throw err;
    })
    .finally(() => {
      taskRunner.saveResumingStates();
      taskRunner.pipeClient?.close();
      originalConsole.info('Task runner finished');
    });
})();
