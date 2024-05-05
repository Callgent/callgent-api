import * as fs from 'node:fs/promises';
import * as pactum from 'pactum';
import { CreateEndpointAuthDto } from '../../src/endpoint-auths/dto/create-endpoint-auth.dto';
import { CreateEndpointDto } from '../../src/endpoints/dto/create-endpoint.dto';
import {
  afterAllFn,
  afterEachFn,
  beforeAllFn,
  beforeEachFnTenanted,
} from '../app-init.e2e';
import { TestConstant } from '../test-constants';
import { addBotletFunctions } from './botlet-functions.e2e-spec';
import { createBotlet } from './botlets.e2e-spec';

/**
 * - create a botlet,
 * - choose webpage receiver endpoint,
 * - config entry, params
 * - config init params
 * - init & test response: success, progressive, failure
 * - confirm
 * - progressive request
 */
describe('Task Actions (e2e)', () => {
  beforeAll(beforeAllFn);
  afterAll(afterAllFn);
  beforeEach(beforeEachFnTenanted);
  afterEach(afterEachFn);

});
