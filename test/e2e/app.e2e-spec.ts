import {
  afterAllFn,
  afterEachFn,
  beforeAllFn,
  beforeEachFn,
} from '../app-init.e2e';

describe('App (e2e)', () => {
  beforeAll(beforeAllFn);
  afterAll(afterAllFn);
  beforeEach(beforeEachFn);
  afterEach(afterEachFn);

  it('Utils test', async () => {
    const fun = () => {
      return require('../../src/infras/libs/utils').Utils.spawn('echo', ['Hello World!']);
    };
    const { stdout } = await fun();
    expect(stdout).toBe('Hello World!\n');
  });
});
