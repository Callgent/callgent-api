import * as bcrypt from 'bcrypt';
import { exec } from 'child_process';
import { jsonrepair } from 'jsonrepair';
import { nanoid, urlAlphabet } from 'nanoid';
import { promisify } from 'util';

const execPromise = promisify(exec);

export class Utils {
  /**
   * @param opt - size: length of the uuid, raw: if false, prefix uuid with intToBase64(mins) since `2024-12-25 08:35`
   * @returns a random uuid, specifically not starts with '-'
   */
  static uuid(opt?: { size?: number; raw?: boolean }) {
    if (opt?.raw)
      for (;;) {
        const id = nanoid(opt?.size);
        if (id[0] != '-') return id;
      }

    // mins = now - `2024-12-25 08:35` + 262144, intToBase64(262144) = '1000'
    // need 31.4 years to reach 'zzzz'
    const prefix = ((Date.now() / 60000) | 0) - 28656451;
    return Utils.intToBase64(prefix) + nanoid(opt?.size);
  }

  static intToBase64(num: number) {
    if (num === 0) return '0';
    let result = '';
    while (num > 0) {
      result = urlAlphabet[num & 63] + result;
      num >>>= 6;
    }
    return result;
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
    // split code blocks, pick the last one
    const pcs = str.split(/^```[\w\s]*$/m);
    if (pcs.length > 2) str = pcs[pcs.length - 2];
    else {
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
    }

    try {
      str = jsonrepair(str);
      return JSON.parse(str);
    } catch (e) {
      console.error(e.stack);
      throw new Error(`(${e.message}): toJSON(${txt}, ${isArray})`);
    }
  }

  static sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static formalApiName = (method: string, path: string) =>
    `${method.toUpperCase()} ${path}`;

  static toFunction<T extends Function>(funCode: string): T {
    try {
      const fun = new Function('return ' + funCode)();
      const type = typeof fun;
      if (type === 'function') return fun;
      throw new Error('code is not a function, but a ' + type);
    } catch (e) {
      throw new Error('Invalid function code, msg: ' + e.message);
    }
  }

  static uniqueBy<T>(arr: T[], key: keyof T) {
    const exists = new Set();
    return arr?.filter((x) => {
      if (exists.has(x[key])) return false;
      exists.add(x[key]);
      return true;
    });
  }

  /**
   * @param orders - e.g. 'name:asc,age:desc'
   */
  static parseOrderBy<T>(
    orders: string,
    fieldsAllowed?: (keyof T)[] | keyof T,
  ): T[] | undefined {
    const fields = orders?.split(',');
    if (!fields?.length) return undefined;
    const allowed = Array.isArray(fieldsAllowed)
      ? fieldsAllowed
      : fieldsAllowed && [fieldsAllowed];
    const orderBy = fields.reduce((acc, field) => {
      const [key, order] = field.split(':');
      if (!key || !order || (allowed && !allowed.includes(key as keyof T)))
        return acc;
      const o = { [key]: order === 'asc' ? 'asc' : 'desc' };
      acc.push(o as T);
      return acc;
    }, [] as T[]);
    return orderBy.length ? orderBy : undefined;
  }

  static truncate(str, maxBytes, encoding: BufferEncoding = 'utf8') {
    let result = '';
    let byteLength = 0;

    for (let char of str) {
      const charByteLength = Buffer.byteLength(char, encoding);
      if (byteLength + charByteLength > maxBytes) break;

      result += char;
      byteLength += charByteLength;
    }

    return result;
  }
}

/** to make some props optional, e.g. Optional<SourceType, 'prop2' | 'prop3'> */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type Requires<T, K extends keyof T> = T & Required<Pick<T, K>>;
