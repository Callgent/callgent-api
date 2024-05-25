import * as pactum from 'pactum';
import { BotletApiText } from '../../src/botlet-functions/botlet-functions.controller';
import {
  afterAllFn,
  afterEachFn,
  beforeAllFn,
  beforeEachFnTenanted,
} from '../app-init.e2e';
import { TestConstant } from '../test-constants';

describe('BotletFunctionsController (e2e)', () => {
  beforeAll(beforeAllFn);
  afterAll(afterAllFn);
  beforeEach(beforeEachFnTenanted);
  afterEach(afterEachFn);

  it('should add botlet functions', () => {});
});

export const addBotletFunctions = (apiTxt: BotletApiText) => {
  return pactum
    .spec()
    .post('/api/botlet-functions/import')
    .withHeaders('x-callgent-authorization', TestConstant.authToken)
    .withBody(apiTxt)
    .expectStatus(201);
};
