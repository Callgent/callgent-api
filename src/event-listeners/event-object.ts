import { EventCallbackType } from '@prisma/client';
import path from 'path';
import { Utils } from '../infras/libs/utils';

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

    this.taskId = this._getTaskId(taskId);

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
  public declare readonly context: { [key: string]: any };
  /** if true, the event will not be propagated to other listeners */
  public declare stopPropagation: boolean;

  /** event status/msg:  <0: error, 0: done, 1: processing, 2: pending, others: http status */
  public statusCode?: number;
  public message?: string;

  /**
   * @returns taskId{task id}: `{yyMMdd}-{nanoid}`
   */
  protected _getTaskId(taskId: string) {
    let sp = taskId?.split('-', 2);
    if (
      !(taskId?.length == this.id.length + 7) ||
      sp[0].length !== 6 ||
      parseInt(sp[0]) + '' !== sp[0]
    ) {
      sp = [this._getUTCDateString(), this.id];
      taskId = sp.join('-');
    }
    return taskId;
  }

  /** get task working dir */
  public getTaskCwd(base: string) {
    const sp = this.taskId.split('-', 2);
    return path.join(
      base,
      sp[0].substring(0, 4), // yyMM
      sp[0].substring(4), // dd
      sp[1].at(-1), // id[-1:]
      sp[1], // id
    );
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

/** response from service endpoint */
export class ServiceResponse {
  data?: any;
  headers?: { [key: string]: any };
  status: number;
  statusText?: string;
}
