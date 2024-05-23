import { SetMetadata } from '@nestjs/common';

export const IS_BOTLET_ENDPOINT_ADAPTOR = 'isBotletEndpointAdaptor';
export const EndpointAdaptorName = (
  name: string,
  type: 'receiver' | 'sender' | 'both',
) => SetMetadata(IS_BOTLET_ENDPOINT_ADAPTOR, `${name}:${type}`);
