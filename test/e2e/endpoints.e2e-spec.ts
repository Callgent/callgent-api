import * as pactum from 'pactum';
import { CallgentApiText } from '../../src/endpoints/endpoints.controller';
import {
  afterAllFn,
  afterEachFn,
  beforeAllFn,
  beforeEachFnTenanted,
} from '../app-init.e2e';
import { TestConstant } from '../test-constants';

describe('EndpointsController (e2e)', () => {
  beforeAll(beforeAllFn);
  afterAll(afterAllFn);
  beforeEach(beforeEachFnTenanted);
  afterEach(afterEachFn);

  it('should add endpoints', () => {});
});

export const addEndpoints = (apiTxt: CallgentApiText) => {
  return pactum
    .spec()
    .post('/api/endpoints/import')
    .withHeaders('x-callgent-authorization', TestConstant.authToken)
    .withBody(apiTxt)
    .expectStatus(201);
};
