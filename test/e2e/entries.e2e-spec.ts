import * as fs from 'node:fs/promises';
import * as pactum from 'pactum';
import { CreateEntryDto } from '../../src/entries/dto/create-entry.dto';
import {
  afterAllFn,
  afterEachFn,
  beforeAllFn,
  beforeEachFnTenanted,
} from '../app-init.e2e';
import { TestConstant } from '../test-constants';
import { createCallgent } from './callgents.e2e-spec';
import { addEndpoints } from './endpoints.e2e-spec';

/**
 * - create a callgent,
 * - choose webpage receiver entry,
 * - config entry, params
 * - config init params
 * - init & test response: success, progressive, failure
 * - confirm
 * - progressive request
 */
describe('Callgent Entry (e2e)', () => {
  beforeAll(beforeAllFn);
  afterAll(afterAllFn);
  beforeEach(beforeEachFnTenanted);
  afterEach(afterEachFn);

  it(`(POST): add a new canny.io rest-api server entry to invoke 400`, async () => {
    const callgent = await prepareCannyCallgent();

    // request for task by callgent api
    await invokeCallgentByApi(callgent.id).expectStatus(400);
  });

  it(`(POST): add a new canny.io rest-api server entry to invoke 200`, async () => {
    const callgent = await prepareCannyCallgent();

    // mount server entry auth

    // request for task by callgent api
    await invokeCallgentByApi(callgent.id).expectStatus(400);
  });
});

export const prepareCannyCallgent = async () => {
  // create the callgent
  const {
    json: { data: callgent },
  } = await createCallgent();

  // add api server entry
  const {
    json: { data: serverEntry },
  } = await createEntry('restAPI', {
    callgentId: callgent.id,
    type: 'SERVER',
    host: 'https://canny.io/api/v1',
  });

  // import api definitions
  const jsonData = await fs.readFile('./test/e2e/data/canny-apis.json', 'utf8');
  const {
    json: { data: functionCount },
  } = await addEndpoints({
    entryId: serverEntry.id,
    text: jsonData,
    format: 'json',
  });

  console.log({ functionCount });

  return callgent;
};

export const createEntry = (
  adaptorKey: string,
  endpointDto: CreateEntryDto,
) => {
  return pactum
    .spec()
    .post(`/api/Entries/${adaptorKey}/create`)
    .withHeaders('x-callgent-authorization', TestConstant.authToken)
    .withBody(endpointDto)
    .expectStatus(201);
};

export const invokeCallgentByApi = (callgentId, body?: any) => {
  return pactum
    .spec()
    .post(`/api/rest/invoke/${callgentId}//boards/list`)
    .withHeaders('x-callgent-authorization', TestConstant.authToken)
    .withBody(body)
    .expectStatus(200);
};
