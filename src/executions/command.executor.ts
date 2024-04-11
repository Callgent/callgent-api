import { Injectable } from '@nestjs/common';
import { Command, Instruction } from './command.schema';

@Injectable()
export class CommandExecutor {
  async exec(cmd: Command, ctx) {
    const { func, exec } = this._flow(cmd);

    // 当伪代码形成vars后，指令会读取值，
    // 需要赋值到vars？还是resp传递下去，赋值由mapping代码来做

    return cmd;
  }

  protected async _exec(ins: Instruction | Instruction[]) {
    return ins;
  }
}
