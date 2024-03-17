import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';

export class Utils {
  // Define a static async method to generate UUIDs
  static uuid() {
    return nanoid();
  }

  static async hashSalted(pwd: string): Promise<string> {
    const salt = await bcrypt.genSalt();
    return bcrypt.hash(pwd, salt);
  }

  static async hashCompare(pwd: string, hash: string) {
    return bcrypt.compare(pwd, hash);
  }
}
