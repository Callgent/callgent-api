import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EmailTemplateProvider } from './email-template.provider';
import path from 'path';

@Injectable()
export class EmailsService implements OnModuleInit {
  private readonly logger = new Logger(EmailsService.name);
  constructor(
    private readonly configService: ConfigService,
    private emailTemplates: EmailTemplateProvider,
  ) {}

  async onModuleInit() {
    await this.emailTemplates.loadTemplates(path.join(__dirname, 'templates'));
  }

  async sendTemplateMail(
    to: { name: string; email: string }[],
    template: string,
    context: { [key: string]: any } = {},
    sender?: { name: string; email: string },
  ): Promise<boolean> {
    const content = this.emailTemplates.render(template, {
      ...context,
      to,
      configs: this.configService,
    });
    const subject = this._extractSubject(content);
    if (!subject) throw new Error('No subject found. template=' + template);
    return this.sendMail(to, subject, content, sender);
  }

  private _extractSubject(content: string) {
    const idx = content.indexOf('<title>');
    if (idx < 0) return;
    return content.substring(idx + 7, content.indexOf('</title>')).trim();
  }

  async sendMail(
    to: string[] | { name: string; email: string }[],
    subject: string,
    htmlContent: string,
    sender?: { name: string; email: string },
  ) {
    const apiKey = this.configService.get('EMAIL_BREVO_API_KEY');
    sender ||
      (sender = JSON.parse(this.configService.get('EMAIL_DEFAULT_SENDER')));

    // https://developers.brevo.com/reference/sendtransacemail
    const url = 'https://api.brevo.com/v3/smtp/email';
    const data = {
      to,
      sender,
      subject,
      htmlContent,
      headers: { charset: 'UTF-8' },
    };
    const headers = {
      accept: 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    };
    await axios.post(url, data, { headers }).then(function (data) {
      Logger.debug('API called successfully. Returned data: %j', data?.data);
    });
    return true;
  }

  // private _getTemplateId(template: string) {
  //   const templateKey = 'BREVO-' + template;
  //   const templateId = this.configService.get(templateKey);
  //   if (!templateId)
  //     throw new Error('Brevo email template not found: ' + templateKey);
  //   return parseInt(templateId);
  // }
}
