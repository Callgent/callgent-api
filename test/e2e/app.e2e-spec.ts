import * as pactum from 'pactum';
import {
  afterAllFn,
  afterEachFn,
  beforeAllFn,
  beforeEachFn,
} from '../app-init.e2e';

describe('AppController (e2e)', () => {
  beforeAll(beforeAllFn);
  afterAll(afterAllFn);
  beforeEach(beforeEachFn);
  afterEach(afterEachFn);

  it('/api (GET)', () => {
    return pactum
      .spec()
      .get('/api')
      .expectStatus(200)
      .expectBody('Hello World!');
  });
});
