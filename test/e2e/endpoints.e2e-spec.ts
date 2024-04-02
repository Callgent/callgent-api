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
import { addBotletActions } from './botlet-api-actions.e2e-spec';
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
describe('Botlet Endpoint (e2e)', () => {
  beforeAll(beforeAllFn);
  afterAll(afterAllFn);
  beforeEach(beforeEachFnTenanted);
  afterEach(afterEachFn);

  it(`(POST): add a new canny.io rest-api server endpoint`, async () => {
    // create the botlet
    const {
      json: { data: botlet },
    } = await createBotlet();

    // add api server endpoint
    const {
      json: { data: serverEndpoint },
    } = await createEndpoint('restAPI', {
      botletUuid: botlet.uuid,
      type: 'SERVER',
      host: { url: 'https://canny.io/api/v1' },
    });

    const jsonData = await fs.readFile(
      './test/e2e/data/canny-apis.json',
      'utf8',
    );
    const {
      json: { data: actionCount },
    } = await addBotletActions({
      endpointUuid: serverEndpoint.uuid,
      text: jsonData,
      format: 'openAPI',
    });

    // request for task by botlet api

    // add event endpoint
    // const {
    //   json: { data: receiver },
    // } = await createEndpoint('restAPI', {
    //   botletUuid: botlet.uuid,
    //   receiver: true,
    //   entry: { path: '/canny/webhook' },
    //   authType: 'APP',
    //   authConfig: [],
    //   reqParamTemplate: [],
    // });

    console.log({ serverEndpoint, actionCount });
  });
});

export const createEndpoint = (
  adaptorKey: string,
  endpointDto: CreateEndpointDto,
) => {
  return pactum
    .spec()
    .post(`/api/endpoints/${adaptorKey}/botlets`)
    .withBearerToken(TestConstant.authToken)
    .withBody(endpointDto)
    .expectStatus(201);
};

export const addEndpointAuth = (endpointAuthDto: CreateEndpointAuthDto) => {
  return pactum
    .spec()
    .put(`/api/endpoints/auth`)
    .withBearerToken(TestConstant.authToken)
    .withBody(endpointAuthDto)
    .expectStatus(200);
};
