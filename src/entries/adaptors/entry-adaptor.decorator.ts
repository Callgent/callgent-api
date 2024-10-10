import { SetMetadata } from '@nestjs/common';

export const IS_CALLGENT_ENDPOINT_ADAPTOR = 'isCallgentEntryAdaptor';
export const EntryAdaptorName = (
  name: string,
  type: 'client' | 'server' | 'both',
) => SetMetadata(IS_CALLGENT_ENDPOINT_ADAPTOR, `${name}:${type}`);
