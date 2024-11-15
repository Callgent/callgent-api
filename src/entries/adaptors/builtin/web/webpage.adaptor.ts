import { Inject, NotImplementedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AgentsService } from '../../../../agents/agents.service';
import { EntryDto } from '../../../dto/entry.dto';
import { ClientRequestEvent } from '../../../events/client-request.event';
import { ClientEntryAdaptor } from '../../entry-adaptor.base';
import { EntryAdaptorDecorator } from '../../entry-adaptor.decorator';

@EntryAdaptorDecorator('Webpage', { client: '/icons/Webpage.svg' })
export class WebpageAdaptor extends ClientEntryAdaptor {
  constructor(@Inject('AgentsService') readonly agentsService: AgentsService) {
    super(agentsService);
  }

  _genClientHost(data: Prisma.EntryUncheckedCreateInput) {
    data.host = `/api/webpage/request/${data.callgentId}/${data.id}`;
  }

  async preprocess(reqEvent: ClientRequestEvent, entry: EntryDto) {
    //
  }

  /** generate a web page entry */
  initClient(params: object, entry: EntryDto): Promise<string> {
    throw new NotImplementedException('Method not implemented.');
  }

  callback(resp: any): Promise<boolean> {
    throw new NotImplementedException('Method not implemented.');
  }

  getCallback(callback: string, reqEntry?: EntryDto): Promise<string> {
    throw new NotImplementedException('Method not implemented.');
  }

  // getConfig(): EntryConfig {
  //   return {
  //     host: { address: { type: 'url', name: 'Page URL' } },
  //     server: {
  //       addParams: true,
  //       params: [
  //         {
  //           type: 'readonly',
  //           name: 'Note',
  //           position: 'top',
  //           value:
  //             '> This is for simple web page operations. For complex pages such as SPA, you may need other tools, e.g. RPAs, [SeeAct](https://github.com/OSU-NLP-Group/SeeAct), etc.',
  //         },
  //         {
  //           type: 'readonly',
  //           name: 'Download Chrome Plugin',
  //           position: 'bottom',
  //           value:
  //             'Before continue, please confirm this automation does NOT violate any ToS or regulations of the target website!  \nYour need to install the [Callgent Web Page](https://chrome.google.com/webstore/detail/callgent-web-page/pefjgjgjgjgjgjgjgjgjgjgjgjgjgjgj) Chrome plugin, as the operation client.  \n> Note: You need to keep the Chrome open to perform tasks.',
  //         },
  //       ],
  //     },
  //     client: {
  //       host: {
  //         address: {
  //           type: 'domain',
  //           name: 'Custom Domain',
  //           value: 'page.callgent.com',
  //           placeholder: 'Not applicable in Free plan.',
  //         },
  //       },
  //       params: [
  //         { type: 'radio', name: 'Page Type', value: ['WEB', 'React', 'Vue'] },
  //       ],
  //       addParams: true,
  //       initParams: [
  //         {
  //           name: 'Page Generation Prompt',
  //           type: 'textarea',
  //           placeholder: 'Prompt or content to generate the Web Page.',
  //         },
  //       ],
  //     },
  //   };
  // }
}
