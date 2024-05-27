import * as pactum from 'pactum';
import { CallgentApiText } from '../../src/callgent-functions/callgent-functions.controller';
import {
  afterAllFn,
  afterEachFn,
  beforeAllFn,
  beforeEachFnTenanted,
} from '../app-init.e2e';
import { TestConstant } from '../test-constants';

describe('CallgentFunctionsController (e2e)', () => {
  beforeAll(beforeAllFn);
  afterAll(afterAllFn);
  beforeEach(beforeEachFnTenanted);
  afterEach(afterEachFn);

  it('should add callgent functions', () => {});
});

export const addCallgentFunctions = (apiTxt: CallgentApiText) => {
  return pactum
    .spec()
    .post('/api/callgent-functions/import')
    .withHeaders('x-callgent-authorization', TestConstant.authToken)
    .withBody(apiTxt)
    .expectStatus(201);
};
