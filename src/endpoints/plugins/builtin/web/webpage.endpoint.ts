import { EndpointDto } from '../../../dto/endpoint.dto';
import { EndpointPluginName } from '../../endpoint-plugin.decorator';
import { EndpointConfig, EndpointInterface } from '../../../endpoint.interface';

@EndpointPluginName('webpage', 'both')
export class WebpageEndpoint implements EndpointInterface {
  getConfig(): EndpointConfig {
    return {
      entry: { address: { type: 'url', name: 'Page URL' } },
      sender: {
        addParams: true,
        params: [
          {
            type: 'readonly',
            name: 'Note',
            position: 'top',
            value:
              '> This is for simple web page operations. For complex pages such as SPA, you may need other tools, e.g. RPAs, [SeeAct](https://github.com/OSU-NLP-Group/SeeAct), etc.',
          },
          {
            type: 'readonly',
            name: 'Download Chrome Plugin',
            position: 'bottom',
            value:
              'Before continue, please confirm this automation does NOT violate any ToS or regulations of the target website!  \nYour need to install the [Botlet Web Page](https://chrome.google.com/webstore/detail/botlet-web-page/pefjgjgjgjgjgjgjgjgjgjgjgjgjgjgj) Chrome plugin, as the operation client.  \n> Note: You need to keep the Chrome open to perform tasks.',
          },
        ],
      },
      receiver: {
        entry: {
          address: {
            type: 'domain',
            name: 'Custom Domain',
            value: 'page.botlet.io',
            placeholder: 'Not applicable in Free plan.',
          },
        },
        params: [
          { type: 'radio', name: 'Page Type', value: ['WEB', 'React', 'Vue'] },
        ],
        addParams: true,
        initParams: [
          {
            name: 'Page Generation Prompt',
            type: 'textarea',
            placeholder: 'Prompt or content to generate the Web Page.',
          },
        ],
      },
    };
  }

  /** generate a web page endpoint */
  initReceiver(params: object, endpoint: EndpointDto): Promise<string> {
    throw new Error('Method not implemented.');
  }

  /** generate operation script based on the Chrome plugin */
  initSender(initParams: object, endpoint: EndpointDto): Promise<string> {
    // - scrape the web page
    const url = endpoint.entry['Page URL'];
    // - script to fill params into the page
    const reqTemplate = endpoint.reqParamTemplate;
    // - script to operate the page
    // auth handler
    throw new Error('Method not implemented.');
  }
}
