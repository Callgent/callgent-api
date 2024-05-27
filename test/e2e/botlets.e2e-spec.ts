import * as pactum from 'pactum';
import { CreateBotletDto } from '../../src/botlets/dto/create-botlet.dto';
import {
  afterAllFn,
  afterEachFn,
  beforeAllFn,
  beforeEachFnTenanted,
} from '../app-init.e2e';
import { TestConstant } from '../test-constants';

describe('BotletsController (e2e)', () => {
  beforeAll(beforeAllFn);
  afterAll(afterAllFn);
  beforeEach(beforeEachFnTenanted);
  afterEach(afterEachFn);

  const endpoint = '/api/botlets';
  it(`${endpoint} (POST): create new botlet no auth, 401`, async () => {
    await createBotlet({}, false);
  });

  it(`${endpoint} (POST): create new botlet.`, async () => {
    await createBotlet();
  });
});

export const createBotlet = (
  botletDto?: Partial<CreateBotletDto>,
  auth = true,
) => {
  const dto = {
    name: 'new-test-botlet',
    ...botletDto,
  };
  return pactum
    .spec()
    .post('/api/botlets')
    .withHeaders(
      'x-callgent-authorization',
      auth ? TestConstant.authToken : 'invalid auth token',
    )
    .withBody(dto)
    .expectStatus(auth ? 201 : 401);
};

export const invokeBotlet = (
  botletDto?: Partial<CreateBotletDto>,
  auth = true,
) => {
  const dto = {
    name: 'new-test-botlet',
    ...botletDto,
  };
  return pactum
    .spec()
    .post('/api/botlets')
    .withHeaders(
      'x-callgent-authorization',
      auth ? TestConstant.authToken : 'invalid auth token',
    )
    .withBody(dto)
    .expectStatus(auth ? 201 : 401);
};
