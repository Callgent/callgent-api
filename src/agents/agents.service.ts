import { Injectable } from '@nestjs/common';
import { BotletMethodDto } from '../botlet-methods/dto/botlet-method.dto';
import { AdaptedDataSource } from '../endpoints/adaptors/endpoint-adaptor.interface';
import { TaskActionDto } from '../task-actions/dto/task-action.dto';
import { LLMService as LLMService } from './llm.service';

@Injectable()
export class AgentsService {
  constructor(private readonly llmService: LLMService) {}

  async api2Function(
    format: string,
    handle: string,
    args: { [key: string]: string },
  ) {
    return this.llmService.template(
      'api2Function',
      {
        format,
        handle,
        ...args,
      },
      { signature: '', documents: '', arrowFunc: '' },
    );
    return {
      signature:
        'async retrieveBoard(invoke: (req: { url: string; method: string; headers?: { [key: string]: string }; body?: { apiKey: string; }; params?: { id: string; }; }) => Promise<{ data: any; dataType: string; headers?: { [key: string]: string }; status?: number; statusText?: string; }>, id: string, apiKey: string)',
      documents:
        "Retrieve a board by its ID. \n@param {string} id - The ID of the board. \n@param {string} apiKey - Your secret API key. \n@returns {object} - The retrieved board object, if a valid ID was supplied. The object includes the following properties: \n- id: {string} A unique identifier for the board. \n- created: {string} Time at which the board was created, in ISO 8601 format. \n- isPrivate: {boolean} Whether or not the board is set as private in the administrative settings. \n- name: {string} The board's name. \n- postCount: {integer} The number of non-deleted posts associated with the board. This number includes posts that are marked as closed or complete. \n- privateComments: {boolean} Whether or not comments left on posts can be viewed by other end-users. \n- url: {string} The URL to the board's page.",
      arrowFunc:
        "(invoke, id, apiKey) => {\n  if (!id || !apiKey) {\n    throw new Error('Both ID and API key are required.');\n  }\n  const req = {\n    url: `/boards/retrieve/${id}`,\n    method: 'POST',\n    headers: { 'Content-Type':  'application/json ' },\n    body: { apiKey },\n    params: { id }\n  };\n  const resp = await invoke(req);\n  if (resp.status !== 200) {\n    throw new Error(`API request failed with status ${resp.status}: ${resp.statusText}`);\n  }\n  return resp.data;\n}",
    };
  }

  async genScript(
    botletMethods: { [botletName: string]: BotletMethodDto[] },
    taskAction: TaskActionDto,
  ) {
    throw new Error('Method not implemented.');
  }

  async genPseudoCmd(
    botlets: { uuid: string; name: string; summary: string }[],
    taskaAction: TaskActionDto,
  ) {}

  async routeAction(actions: BotletMethodDto[], req: AdaptedDataSource) {
    if (!actions?.length) return;
    // FIXME：是否需要task上下文来决定路由，
    return actions[0];
  }

  /** map request params from task ctx */
  async mapParams(content: any, req: AdaptedDataSource) {
    // 从任务上下文中获取参数，并返回标准json参数结构？由server适配器封装为想要的格式
    return [];
  }
}
