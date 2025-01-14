import { default as TaskRunner } from './main.js';
import * as chroot from 'chroot';
import * as fs from 'fs';

// - add `invokeService` method
// - manage resumingStates
// - error fixing and retrying
class ExtendedTaskRunner extends TaskRunner {
  constructor() {
    super();
    this.loadResumingStates();
  }
  declare resumingStates: any;
  private readonly resumingStatesFile = './resumingStates.json';

  async invokeService(
    purposeKey: string,
    args: { parameters?: any; requestBody?: any },
  ) {
    console.log('Service invoked...');
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

const allowedDirectory = __dirname;
chroot(allowedDirectory, (err) => {
  if (err) {
    console.error('Failed to chroot:', err);
    process.exit(1);
  }

  const taskRunner = new ExtendedTaskRunner();
  taskRunner
    .execute()
    .then(() => {
      // todo
    })
    .catch((err) => {
      console.error('Failed to execute task runner.', err);
    })
    .finally(() => taskRunner.saveResumingStates());
});
