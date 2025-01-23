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

  constructor(cmdPrefix: string) {
    super();
    this.pipeClient = new PipeClient('./pipe.socket', cmdPrefix);
    this.loadResumingStates();
  }
  async invokeService(
    purposeKey: string,
    args: { parameters?: { [paramName: string]: any }; requestBody?: any },
  ) {
    const epName = purposes.find((p) => p.purposeKey === purposeKey)?.epName;
    if (!epName) throw new Error(`Unknown purposeKey: ${purposeKey}`);

    const r = await this.pipeClient.sendCommand(
      JSON.stringify({ epName, args }),
    );
    try {
      return JSON.parse(r);
    } catch (e) {
      console.error('Failed to parse response from pipe client', e);
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

(() => {
  const cmdPrefix = process.argv[2];
  console.log('Starting task runner with prefix:', cmdPrefix);

  // FIXME: restrict allowed directory
  // const allowedDirectory = __dirname;

  const taskRunner = new ExtendedTaskRunner(cmdPrefix);
  taskRunner
    .execute()
    .then(() => {
      // todo
    })
    .catch((err) => {
      console.error('Failed to execute task runner.', err);
      throw err;
    })
    .finally(
      () => (taskRunner.saveResumingStates(), taskRunner.pipeClient?.close()),
    );
})();
