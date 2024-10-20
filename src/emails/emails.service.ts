import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import axios from 'axios';
import path from 'path';
import { RelayEmail } from './dto/sparkpost-relay-object.interface';
import { EmailTemplateProvider } from './email-template.provider';
import { EmailRelayEvent } from './events/email-relay.event';
import { Transactional } from '@nestjs-cls/transactional';

@Injectable()
export class EmailsService implements OnModuleInit {
  private readonly logger = new Logger(EmailsService.name);
  constructor(
    private readonly configService: ConfigService,
    private emailTemplates: EmailTemplateProvider,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    await this.emailTemplates.loadTemplates(path.join(__dirname, 'templates'));
  }

  /**
   * @param template - template file name
   */
  async sendTemplateEmail(
    to:
      | string
      | { name: string; email: string }
      | (string | { name: string; email: string })[],
    template: string,
    context: { [key: string]: any } = {},
    sender?: string | { name: string; email: string },
  ): Promise<boolean> {
    to = this._formalizeEmails(to) as { name: string; email: string }[];
    sender = sender
      ? this._formalizeEmails(sender)[0]
      : (sender = JSON.parse(this.configService.get('EMAIL_DEFAULT_SENDER')));

    const content = this.emailTemplates.render(template, {
      ...context,
      to,
      sender,
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
    this.logger.debug('Sending email to %j. from: %j', to, sender);
    try {
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
    } catch (err) {
      this.logger.error('Failed to send email to %j. err: %s', to, err.message);
      throw err;
    }
  }
  private _formalizeEmails(
    emails:
      | (string | { name: string; email: string })
      | (string | { name: string; email: string })[],
  ) {
    if (!Array.isArray(emails)) emails = [emails];
    return emails.map((d) => {
      const email = (d as any).email || d;
      const name = (d as any).name || email.split('@')[0];
      return { name, email };
    });
  }

  // private _getTemplateId(template: string) {
  //   const templateKey = 'BREVO-' + template;
  //   const templateId = this.configService.get(templateKey);
  //   if (!templateId)
  //     throw new Error('Brevo email template not found: ' + templateKey);
  //   return parseInt(templateId);
  // }

  /**
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
  @Transactional()
  handleRelayEmail(email: RelayEmail): void {
    const mailTo = email?.rcpt_to;
    const mailHost = this.configService.get('EMAIL_RELAY_HOST');
    if (!mailTo?.endsWith(mailHost))
      return this.logger.error('Invalid relay host, ignored: %j', email);

    const relayKey = mailTo.substring(0, mailTo.indexOf('+'));
    const relayId = email.content.subject.substring(
      email.content.subject.lastIndexOf('#') + 1,
    );
    switch (relayKey) {
      case 'request':
      case 'callgent':
        // this.logger.debug('relay %j', msg);
        // FIXME persistent emit, to prevent lost event
        this.eventEmitter.emitAsync(
          EmailRelayEvent.eventPrefix + relayKey,
          new EmailRelayEvent(relayKey as EmailRelayKey, relayId, email),
        );
        break;
      default:
        this.logger.error('Invalid relay key %s, ignored: %j', mailTo, email);
    }
  }
}

export enum EmailRelayKey {
  /** ClientRequestEvent callback from email SEP */
  request = 'request',
  /** callgent email CEP */
  callgent = 'callgent',
}
