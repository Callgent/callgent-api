import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { File } from 'fastify-multer/lib/interfaces';
import fs from 'fs';
import path from 'path';
import { RequestFile } from '../entries/adaptors/dto/request-requirement.dto';

@Injectable()
export class FilesService {
  public readonly UPLOAD_BASE_DIR: string;
  constructor(private readonly configService: ConfigService) {
    this.UPLOAD_BASE_DIR = configService.get('UPLOAD_BASE_DIR', './upload');
  }

  /** overwrite existing */
  save(content: { [fileName: string]: string }, dir: string) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    for (const fileName in content) {
      if (content.hasOwnProperty(fileName)) {
        const filePath = path.join(dir, fileName);
        fs.writeFileSync(filePath, content[fileName], 'utf8');
      }
    }
  }

  /** move files into dir, overwrite existing */
  async move(files: File[], dir: string): Promise<RequestFile[]> {
    if (!files?.length) return;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const result = files.map((f) => {
      const newPath = path.join(dir, f.originalname);
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

  /** copy files into dir, overwrite existing */
  async copy(files: File[], dir: string): Promise<RequestFile[]> {
    if (!files?.length) return;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const result = files.map((f) => {
      const newPath = path.join(dir, f.originalname);
      fs.copyFileSync(f.path, newPath);

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
