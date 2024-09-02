import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import path from 'path';
import { EmailTemplateProvider } from './email-template.provider';
import { RelayMessage } from './dto/sparkpost-relay-object.interface';

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

  async sendTemplateEmail(
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
    return this.sendEmail(to, subject, content, sender);
  }

  private _extractSubject(content: string) {
    const idx = content.indexOf('<title>');
    if (idx < 0) return;
    return content.substring(idx + 7, content.indexOf('</title>')).trim();
  }

  async sendEmail(
    to:
      | string
      | { name: string; email: string }
      | (string | { name: string; email: string })[],
    subject: string,
    htmlContent: string,
    sender?: string | { name: string; email: string },
  ) {
    const apiKey = this.configService.get('EMAIL_BREVO_API_KEY');
    to = this._formalizeEmails(to) as { name: string; email: string }[];
    sender = sender
      ? this._formalizeEmails(sender)[0]
      : (sender = JSON.parse(this.configService.get('EMAIL_DEFAULT_SENDER')));

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
    return axios.post(url, data, { headers }).then(function (resp) {
      const sent = resp.status < 300;
      if (!sent) {
        this.logger.error('Failed to send email. resp: %j', {
          ...resp,
          request: { url, data },
        });
      }
      return sent;
    });
  }
  private _formalizeEmails(
    emails:
      | (string | { name: string; email: string })
      | (string | { name: string; email: string })[],
  ) {
    if (!Array.isArray(emails)) emails = [emails];
    return emails.map((d) =>
      (d as any).email ? (d as { email: string }) : { email: d as string },
    );
  }

  // private _getTemplateId(template: string) {
  //   const templateKey = 'BREVO-' + template;
  //   const templateId = this.configService.get(templateKey);
  //   if (!templateId)
  //     throw new Error('Brevo email template not found: ' + templateKey);
  //   return parseInt(templateId);
  // }

  /**
   *
   * @returns `${relayType}+${id}@${mailHost}`
   */
  getRelayAddress(id: string, relayType: EmailRelayKey) {
    const mailHost = this.configService.get('EMAIL_RELAY_HOST');
    return `${relayType}+${id}@${mailHost}`;
  }

  /**
   * sparkpost relay message
   * @see https://developers.sparkpost.com/api/relay-webhooks/
   */
  handleRelayMessage(msg: RelayMessage): void {
    let mailTo = msg?.rcpt_to;
    mailTo = mailTo.toLowerCase();
    const mailHost = this.configService.get('EMAIL_RELAY_HOST');
    if (!mailTo.endsWith(mailHost))
      return this.logger.error('Invalid relay host, ignored message: %j', msg);

    mailTo = mailTo.substring(0, mailTo.indexOf('@'));
    const [relayKey, relayId] = mailTo.split('+');
    switch (relayKey) {
      case 'request':
        this.logger.debug('relay request: %j', msg);
        // TODO
        break;
      case 'callgent':
        this.logger.debug('relay callgent: %j', msg);
        // TODO
        break;
      default:
        this.logger.error(
          'Invalid relay key %s, ignored message: %j',
          relayKey,
          msg,
        );
    }
  }
}

/**
 * 'request': request call from email SEP.
 * 'callgent': callgent email CEP.
 */
export type EmailRelayKey = 'request' | 'callgent';
