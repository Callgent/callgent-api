import * as pactum from 'pactum';
import { CreateCallgentDto } from '../../src/callgents/dto/create-callgent.dto';
import {
  afterAllFn,
  afterEachFn,
  beforeAllFn,
  beforeEachFnTenanted,
} from '../app-init.e2e';
import { TestConstant } from '../test-constants';

describe('CallgentsController (e2e)', () => {
  beforeAll(beforeAllFn);
  afterAll(afterAllFn);
  beforeEach(beforeEachFnTenanted);
  afterEach(afterEachFn);

  const endpoint = '/api/callgents';
  
  it(`${endpoint} (POST): create new callgent no auth, 401`, async () => {
    await createCallgent({}, false);
  });

  it(`${endpoint} (POST): create new callgent.`, async () => {
    await createCallgent();
  });
});

export const createCallgent = (
  callgentDto?: Partial<CreateCallgentDto>,
  auth = true,
) => {
  const dto = {
    name: 'new-test-callgent',
    ...callgentDto,
  };
  return pactum
    .spec()
    .post('/api/callgents')
    .withHeaders(
      'x-callgent-authorization',
      auth ? TestConstant.authToken : 'invalid auth token',
    )
    .withBody(dto)
    .expectStatus(auth ? 201 : 401);
};

export const invokeCallgent = (
  callgentDto?: Partial<CreateCallgentDto>,
  auth = true,
) => {
  const dto = {
    name: 'new-test-callgent',
    ...callgentDto,
  };
  return pactum
    .spec()
    .post('/api/callgents')
    .withHeaders(
      'x-callgent-authorization',
      auth ? TestConstant.authToken : 'invalid auth token',
    )
    .withBody(dto)
    .expectStatus(auth ? 201 : 401);
};
