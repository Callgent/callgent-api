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
  async save(files: File[], pwd: string) {
    if (!files?.length) return [];

    pwd = path.join(this.UPLOAD_ROOT_DIR, pwd);
    if (!fs.existsSync(pwd)) fs.mkdirSync(pwd, { recursive: true });

    const result = files.map((f) => {
      const newPath = path.join(pwd, f.originalname);
      if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
      fs.renameSync(f.path, newPath);

      return {
        filename: f.originalname,
        encoding: f.encoding,
        mimetype: f.mimetype,
        size: f.size,
      };
    });

    return result;
  }
}
