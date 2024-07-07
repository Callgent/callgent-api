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
import { addCallgentFunctions } from './callgent-functions.e2e-spec';
import { createCallgent } from './callgents.e2e-spec';

/**
 * - create a callgent,
 * - choose webpage receiver endpoint,
 * - config entry, params
 * - config init params
 * - init & test response: success, progressive, failure
 * - confirm
 * - progressive request
 */
describe('Callgent Endpoint (e2e)', () => {
  beforeAll(beforeAllFn);
  afterAll(afterAllFn);
  beforeEach(beforeEachFnTenanted);
  afterEach(afterEachFn);

  it(`(POST): add a new canny.io rest-api server endpoint to invoke 400`, async () => {
    const callgent = await prepareCannyCallgent();

    // request for task by callgent api
    await invokeCallgentByApi(callgent.uuid).expectStatus(400);
  });

  it(`(POST): add a new canny.io rest-api server endpoint to invoke 200`, async () => {
    const callgent = await prepareCannyCallgent();

    // mount server endpoint auth

    // request for task by callgent api
    await invokeCallgentByApi(callgent.uuid).expectStatus(400);
  });
});

export const prepareCannyCallgent = async () => {
  // create the callgent
  const {
    json: { data: callgent },
  } = await createCallgent();

  // add api server endpoint
  const {
    json: { data: serverEndpoint },
  } = await createEndpoint('restAPI', {
    callgentUuid: callgent.uuid,
    type: 'SERVER',
    host: 'https://canny.io/api/v1',
  });

  // import api definitions
  const jsonData = await fs.readFile('./test/e2e/data/canny-apis.json', 'utf8');
  const {
    json: { data: functionCount },
  } = await addCallgentFunctions({
    endpoint: serverEndpoint.uuid,
    text: jsonData,
    format: 'openAPI',
  });

  console.log({ serverEndpoint, functionCount });

  return callgent;
};

export const createEndpoint = (
  adaptorKey: string,
  endpointDto: CreateEndpointDto,
) => {
  return pactum
    .spec()
    .post(`/api/endpoints/${adaptorKey}/create`)
    .withHeaders('x-callgent-authorization', TestConstant.authToken)
    .withBody(endpointDto)
    .expectStatus(201);
};

export const addEndpointAuth = (endpointAuthDto: CreateEndpointAuthDto) => {
  return pactum
    .spec()
    .put(`/api/endpoints/auth`)
    .withHeaders('x-callgent-authorization', TestConstant.authToken)
    .withBody(endpointAuthDto)
    .expectStatus(200);
};

export const invokeCallgentByApi = (callgentUuid, body?: any) => {
  return pactum
    .spec()
    .post(`/api/callgents/${callgentUuid}//invoke/api/boards/list`)
    .withHeaders('x-callgent-authorization', TestConstant.authToken)
    .withBody(body)
    .expectStatus(200);
};
