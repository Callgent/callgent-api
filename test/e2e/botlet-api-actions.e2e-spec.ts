import * as pactum from 'pactum';
import { BotletApiText } from '../../src/botlet-api-actions/botlet-api-actions.controller';
import {
  afterAllFn,
  afterEachFn,
  beforeAllFn,
  beforeEachFnTenanted,
} from '../app-init.e2e';
import { TestConstant } from '../test-constants';

describe('BotletApiActionsController (e2e)', () => {
  beforeAll(beforeAllFn);
  afterAll(afterAllFn);
  beforeEach(beforeEachFnTenanted);
  afterEach(afterEachFn);
});

export const addBotletActions = (apiTxt: BotletApiText) => {
  return pactum
    .spec()
    .post('/api/botlet-actions/import')
    .withBearerToken(TestConstant.authToken)
    .withBody(apiTxt)
    .expectStatus(201);
};
