import * as pactum from 'pactum';
import { CreateBotletDto } from '../../src/botlets/dto/create-botlet.dto';
import {
  afterAllFn,
  afterEachFn,
  beforeAllFn,
  beforeEachFnTenanted,
} from '../app-init.e2e';
import { TestConstant } from '../test-constants';

/**
 * - create a botlet,
 * - choose webpage receiver endpoint,
 * - config entry, params
 * - config init params
 * - init & test response: success, progressive, failure
 * - confirm
 * - progressive request
 */
describe('Webpage Receiver Endpoint (e2e)', () => {
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
