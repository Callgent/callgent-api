import * as pactum from 'pactum';
import {
  afterAllFn,
  afterEachFn,
  beforeAllFn,
  beforeEachFnTenanted,
} from '../app-init.e2e';

describe('UsersController (e2e)', () => {
  beforeAll(beforeAllFn);
  afterAll(afterAllFn);
  beforeEach(beforeEachFnTenanted);
  afterEach(afterEachFn);

  it(`/api/users/confirm-email/request (GET): send confirm email`, async () => {
    await sendConfirmEmail({ email: 'dev@callgent.com', create: true });
  });
});

export const sendConfirmEmail = (body: { email: string; create: boolean }) => {
  return pactum
    .spec()
    .post('/api/users/confirm-email/request')
    .withBody(body)
    .expectStatus(201);
};
