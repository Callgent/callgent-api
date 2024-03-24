import { SetMetadata } from '@nestjs/common';

export const IS_BOTLET_ENDPOINT_SERVICE = 'isBotletEndpointService';
export const EndpointServiceName = (
  name: string,
  type: 'receiver' | 'sender' | 'both',
) => SetMetadata(IS_BOTLET_ENDPOINT_SERVICE, `${name}:${type}`);
