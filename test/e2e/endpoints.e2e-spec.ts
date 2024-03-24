import * as pactum from 'pactum';
import { CreateEndpointDto } from '../../src/endpoints/dto/create-endpoint.dto';
import {
  afterAllFn,
  afterEachFn,
  beforeAllFn,
  beforeEachFnTenanted,
  getConfigValue,
} from '../app-init.e2e';
import { TestConstant } from '../test-constants';
import { createBotlet } from './botlets.e2e-spec';
import { CreateEndpointAuthDto } from '../../src/endpoint-auths/dto/create-endpoint-auth.dto';

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

  it(`(POST): add a new canny.io rest-api sender endpoint`, async () => {
    // create the botlet
    const {
      json: { data: botlet },
    } = await createBotlet();

    // add api sender endpoint
    const {
      json: { data: sender },
    } = await createEndpoint('restAPI', {
      botletUuid: botlet.uuid,
      receiver: false,
      entry: { url: 'https://canny.io/api/v1' },
      authType: 'APP',
      authConfig: {
        tokenName: 'apiKey',
        tokenPosition: 'body',
        credentialsType: { credentialsType: 'constant' },
      },
      reqParamTemplate: [], // FIXME openAPI
    });

    // add sender endpoint auth
    const {
      json: { data: senderAuth },
    } = await addEndpointAuth({
      endpointUuid: sender.uuid,
      params: { apiKey: getConfigValue('TEST_CANNY_IO_API_KEY') },
    });

    // add api receiver endpoint, as webhook in canny.io
    const {
      json: { data: receiver },
    } = await createEndpoint('restAPI', {
      botletUuid: botlet.uuid,
      receiver: true,
      entry: { path: '/canny/webhook' },
      authType: 'APP',
      authConfig: [],
      reqParamTemplate: [],
    });

    // send task to the endpoint,

    console.log({ sender, senderAuth, receiver });
  });
});

export const createEndpoint = (
  endpointKey: string,
  endpointDto: CreateEndpointDto,
) => {
  return pactum
    .spec()
    .post(`/api/endpoints/${endpointKey}/botlets`)
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
