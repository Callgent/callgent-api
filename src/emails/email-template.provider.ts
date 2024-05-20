import { Injectable } from '@nestjs/common';
import * as dot from 'dot';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmailTemplateProvider {
  private templates: { [key: string]: dot.RenderFunction } = {};

  async loadTemplates(templatesDir: string) {
    const files = await fs.promises.readdir(templatesDir);
    for (const file of files) {
      if (path.extname(file) === '.dot') {
        const templateName = path.basename(file, '.dot');
        const templateContent = await fs.promises.readFile(
          path.join(templatesDir, file),
          'utf-8',
        );
        this.templates[templateName] = dot.template(templateContent);
      }
    }
  }

  render(templateName: string, data: any) {
    if (!this.templates[templateName]) {
      throw new Error(`Template ${templateName} not found`);
    }
    return this.templates[templateName](data);
  }
}
