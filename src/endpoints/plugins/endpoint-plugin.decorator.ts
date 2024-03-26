import { SetMetadata } from '@nestjs/common';

export const IS_BOTLET_ENDPOINT_PLUGIN = 'isBotletEndpointPlugin';
export const EndpointPluginName = (
  name: string,
  type: 'receiver' | 'sender' | 'both',
) => SetMetadata(IS_BOTLET_ENDPOINT_PLUGIN, `${name}:${type}`);
