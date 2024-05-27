import { SetMetadata } from '@nestjs/common';

export const IS_CALLGENT_ENDPOINT_ADAPTOR = 'isCallgentEndpointAdaptor';
export const EndpointAdaptorName = (
  name: string,
  type: 'receiver' | 'sender' | 'both',
) => SetMetadata(IS_CALLGENT_ENDPOINT_ADAPTOR, `${name}:${type}`);
