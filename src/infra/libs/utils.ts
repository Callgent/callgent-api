import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';

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
}

/** to make some props optional, e.g. Optional<SourceType, 'prop2' | 'prop3'> */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
