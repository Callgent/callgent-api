import { EventCallbackType } from '@prisma/client';
import { Utils } from '../infras/libs/utils';
import path from 'path';

export class EventObject {
  constructor(
    /** src entity id which bind to the listener */
    public readonly srcId: string,
    public readonly eventType: string,
    public readonly dataType: string,
    taskId: string,
    /** url template for response callback, `callgent:epName[@callgent]` to invoke callgent */
    public callback?: string,
    public readonly callbackType: EventCallbackType = 'EVENT',
  ) {
    this.id = Utils.uuid();

    const { taskId: tid, pwd } = this._getTaskConfig(taskId);
    this.taskId = tid;
    this.pwd = pwd;

    Object.defineProperty(this, 'context', {
      value: {},
      enumerable: false,
    });
    Object.defineProperty(this, 'stopPropagation', {
      value: false,
      writable: true,
      enumerable: false,
    });
  }
  public readonly id: string;
  /** task id to relate several events, format: `{yymmdd}-{nanoid}` */
  public readonly taskId: string;
  /** task process dir */
  public readonly pwd: string;
  public declare readonly context: { [key: string]: any };
  /** if true, the event will not be propagated to other listeners */
  public declare stopPropagation: boolean;

  /**
   * @returns {{ taskId: string, pwd: string }}, taskId{task id}: `{yyMMdd}-{nanoid}`, pwd{task working dir}: `{yyMM}/{dd}/{nanoid[:1]}/nanoid`
   */
  protected _getTaskConfig(taskId: string) {
    let sp = taskId?.split('-', 2);
    if (
      !(taskId?.length == this.id.length + 7) ||
      sp[0].length !== 6 ||
      parseInt(sp[0]) + '' !== sp[0]
    ) {
      sp = [this._getUTCDateString(), this.id];
      taskId = sp.join('-');
    }

    return {
      taskId,
      pwd: path.join(
        sp[0].substring(0, 4), // yyMM
        sp[0].substring(4), // dd
        sp[1].substring(0, 1), // id[:1]
        sp[1], // id
      ),
    };
  }

  protected _getUTCDateString() {
    const now = new Date();

    // 获取UTC年份的后两位
    const year = now.getUTCFullYear() % 100;

    // 获取UTC月份（0-11），需要加1
    const month = now.getUTCMonth() + 1;

    // 获取UTC日期
    const day = now.getUTCDate();

    // 格式化为YYMMDD字符串
    const yearStr = String(year).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');

    return `${yearStr}${monthStr}${dayStr}`;
  }
}
