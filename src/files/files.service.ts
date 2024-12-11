import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { File } from 'fastify-multer/lib/interfaces';
import fs from 'fs';
import path from 'path';

@Injectable()
export class FilesService {
  public readonly UPLOAD_ROOT_DIR: string;
  constructor(private readonly configService: ConfigService) {
    this.UPLOAD_ROOT_DIR = configService.get('UPLOAD_ROOT_DIR', './upload');
  }

  /** save into task context dir */
  async save(files: File[], taskId: string) {
    if (!files?.length) return [];

    const dir = this.getUploadDestination(taskId);
    files.forEach((f) => {
      const newPath = path.join(dir, f.originalname);
      if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
      fs.renameSync(f.path, newPath);

      f.path = newPath;
      f.destination = dir;
      f.filename = f.originalname;
    });

    return files;
  }

  /** @returns ${root}/yyMM/dd/taskId[:1]/taskId/ */
  protected getUploadDestination(taskId: string) {
    const [yyMM, dd] = this._getUTCDateString();

    const dir = path.join(
      this.UPLOAD_ROOT_DIR,
      yyMM,
      dd,
      taskId.substring(0, 1),
      taskId,
    );
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    return dir;
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

    return [`${yearStr}${monthStr}`, dayStr];
  }
}
