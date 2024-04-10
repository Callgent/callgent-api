import * as pactum from 'pactum';
import { BotletApiText } from '../../src/botlet-methods/botlet-methods.controller';
import {
  afterAllFn,
  afterEachFn,
  beforeAllFn,
  beforeEachFnTenanted,
} from '../app-init.e2e';
import { TestConstant } from '../test-constants';

describe('BotletMethodsController (e2e)', () => {
  beforeAll(beforeAllFn);
  afterAll(afterAllFn);
  beforeEach(beforeEachFnTenanted);
  afterEach(afterEachFn);

  it('should add botlet actions', () => {});
});

export const addBotletActions = (apiTxt: BotletApiText) => {
  return pactum
    .spec()
    .post('/api/botlet-methods/import')
    .withBearerToken(TestConstant.authToken)
    .withBody(apiTxt)
    .expectStatus(201);
};
