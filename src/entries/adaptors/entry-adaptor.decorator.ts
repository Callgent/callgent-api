import { SetMetadata } from '@nestjs/common';

export const IS_CALLGENT_ENDPOINT_ADAPTOR = 'isCallgentEntryAdaptor';

/**
 * @param key: adaptor name
 * @param types:  { [type]: "icon-url" }
 */
export const EntryAdaptorDecorator = (
  key: string,
  types: { client?: string; server?: string; both?: string },
) => {
  if (key && types && ('both' in types || 'server' in types || 'client' in types))
    return SetMetadata(IS_CALLGENT_ENDPOINT_ADAPTOR, { key, types });

  throw new Error(`Adaptor ${key ? 'types' : 'key'} are required`);
};
