import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { jsonrepair } from 'jsonrepair';

export class Utils {
  // Define a static async method to generate UUIDs
  static uuid(size?: number) {
    return nanoid(size);
  }

  static async hashSalted(pwd: string): Promise<string> {
    const salt = await bcrypt.genSalt();
    return bcrypt.hash(pwd, salt);
  }

  static async hashCompare(pwd: string, hash: string) {
    return bcrypt.compare(pwd, hash);
  }

  static toJSON(txt: string, isArray = false) {
    if (!txt) return undefined;
    if (txt.trim().toLowerCase() == 'null') return null;

    let str = txt;
    const delim = isArray ? '[]' : '{}';

    // TODO find from end to start
    let idx = str.indexOf(delim[0]);
    if (idx < 0) return undefined;

    if (idx > 0) str = str.substring(idx);
    let encloseCount = 1;
    _l: for (idx = 1; idx < str.length; idx++) {
      const i = delim.indexOf(str[idx]);
      switch (i) {
        case 0:
          encloseCount++;
          break;
        case 1:
          encloseCount--;
          if (encloseCount == 0) {
            idx++;
            break _l;
          }
      }
    }
    if (encloseCount != 0)
      throw new Error(
        `Cannot parse to JSON, brackets${delim} not enclosed: toJSON(${txt}, ${isArray})`,
      );
    str = str.substring(0, idx);

    try {
      str = jsonrepair(str);
      return JSON.parse(str);
    } catch (e) {
      console.error(e.stack);
      throw new Error(`(${e.message}): toJSON(${txt}, ${isArray})`);
    }
  }
}

/** to make some props optional, e.g. Optional<SourceType, 'prop2' | 'prop3'> */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
