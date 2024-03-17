import { JwtPayload } from '../infra/auth/jwt/jwt.service';
import { TaskDto } from '../tasks/dto/task.dto';
import { IPlugin } from './plugin';

/** adaptor to convert request to botlet task */
export interface CallerPlugin extends IPlugin {
  /** convert request to botlet task, try create the task, may get quick sync result */
  convertToTask(
    appKey: string,
    body: object,
    caller: JwtPayload,
  ): Promise<TaskDto>;

  respond();
}
