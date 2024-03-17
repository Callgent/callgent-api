import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
  private readonly logger = new Logger(AppController.name);

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post()
  postHello(@Body() body: any): string {
    this.logger.warn(body);
    const postmarkapp_com = {
      FromName: 'JamesP',
      MessageStream: 'inbound',
      From: 'pang.ju@roles.chat',
      FromFull: {
        Email: 'pang.ju@roles.chat',
        Name: 'JamesP',
        MailboxHash: '',
      },
      To: '"ddsfskldfjds+334rfgg@call.botlet.io" <ddsfskldfjds+334rfgg@call.botlet.io>',
      ToFull: [
        {
          Email: 'ddsfskldfjds+334rfgg@call.botlet.io',
          Name: 'ddsfskldfjds+334rfgg@call.botlet.io',
          MailboxHash: '334rfgg',
        },
      ],
      Cc: '',
      CcFull: [],
      Bcc: '',
      BccFull: [],
      OriginalRecipient: 'ddsfskldfjds+334rfgg@call.botlet.io',
      Subject: 'Re: sfddsf',
      MessageID: '3e157239-b8c7-4a88-9cba-51c3a5690a15',
      ReplyTo: '',
      MailboxHash: '334rfgg',
      Date: 'Fri, 01 Mar 2024 22:46:07 +0800',
      TextBody:
        'Sdfsdf <a href="dfd">sddfds</a>\nAppController\n\nddsfskldfjds+334rfgg@call.botlet.io\n\n\nsdf\n> From: "JamesP"<pang.ju@roles.chat>\n> Date:  Fri, Mar 1, 2024, 22:43\n> Subject:  sfddsf\n> To: "ddsfskldfjds+334rfgg@call.botlet.io"<ddsfskldfjds+334rfgg@call.botlet.io>\n> S<ddsfskldfjds+334rfgg@call.botlet.io>dfsdfsdfdsvbbf df',
      HtmlBody:
        '<html><head></head><body><div id="editor_version_7.11.5_mTvKGVOk" style="word-break:break-word;"><div data-zone-id="0" data-line-index="0" data-line="true" style="margin-top: 4px; margin-bottom: 4px; line-height: 1.6;"><div dir="auto" style="font-size: 14px;">Sdfsdf &lt;a href=&#34;dfd&#34;&gt;sddfds&lt;/a&gt;</div></div><div data-zone-id="0" data-line-index="1" data-line="true" style="margin-top: 4px; margin-bottom: 4px; line-height: 18px;"><div data-line-height="18px" dir="auto" style="font-size: 14px;"><span style="font-size: 12px;"><span style="font-family: Menlo, Monaco, monospace;"><span style="color: rgb(78, 201, 176);"><span style="background-color: rgb(31, 31, 31);">AppController</span></span></span></span></div></div><div data-zone-id="0" data-line-index="2" data-line="true" style="margin-top: 4px; margin-bottom: 4px; line-height: 1.6;"><div dir="auto" style="font-size: 14px;"><br/></div></div><div data-zone-id="0" data-line-index="3" data-line="true" style="margin-top: 4px; margin-bottom: 4px; line-height: 1.6;"><div dir="auto" style="font-size: 14px;"><span style="font-size: 14px;"><span style="font-family: LarkHackSafariFont, LarkEmojiFont, LarkChineseQuote, -apple-system, Tahoma, &#34;PingFang SC&#34;, Arial, sans-serif;"><span style="background-color: rgb(41, 41, 41);"><a class="not-doclink" href="mailto:ddsfskldfjds+334rfgg@call.botlet.io" linkid="Uw6fUNZULo" target="_blank" rel="noopener noreferrer" style="transition: color 0.3s ease 0s; cursor: pointer; text-decoration: none; color: rgb(20, 86, 240);">ddsfskldfjds+334rfgg@call.botlet.io</a></span></span></span><span style="font-size: 12px;"><span style="font-family: Menlo, Monaco, monospace;"><span style="color: rgb(78, 201, 176);"><span style="background-color: rgb(31, 31, 31);"></span></span></span></span></div></div><div data-zone-id="0" data-line-index="4" data-line="true" style="margin-top: 4px; margin-bottom: 4px; line-height: 1.6;"><div dir="auto" style="font-size: 14px;"><span style="font-size: 12px;"><span style="font-family: Menlo, Monaco, monospace;"><span style="color: rgb(78, 201, 176);"><span style="background-color: rgb(31, 31, 31);"><br/></span></span></span></span></div></div><div data-zone-id="0" data-line-index="5" data-line="true" style="margin-top: 4px; margin-bottom: 4px; line-height: 1.6;"><div dir="auto" style="font-size: 14px;"><span style="font-size: 12px;"><span style="font-family: Menlo, Monaco, monospace;"><span style="color: rgb(78, 201, 176);"><span style="background-color: rgb(31, 31, 31);"><br/></span></span></span></span></div></div><div data-zone-id="0" data-line-index="6" data-line="true" style="margin-top: 4px; margin-bottom: 4px; line-height: 1.6;"><div dir="auto" style="font-size: 14px;"><span style="font-size: 12px;"><span style="font-family: Menlo, Monaco, monospace;"><span style="color: rgb(78, 201, 176);"><span style="background-color: rgb(31, 31, 31);">sdf</span></span></span></span></div></div></div><div class="history-quote-wrapper" id="lark-mail-quote-170930435"><div data-html-block="quote" data-mail-html-ignore=""><div style="border-left: none; padding-left: 0px;" class="adit-html-block adit-html-block--collapsed"><div><div class="adit-html-block__attr history-quote-meta-wrapper history-quote-gap-tag" id="lark-mail-meta-khKhvIkej" style="padding: 12px; background: rgb(245, 246, 247); color: rgb(31, 35, 41); border-radius: 4px; margin-top: 24px; margin-bottom: 12px;"><div id="lark-mail-quote-2c65595eca6cb6631b7a23f21b865f8a"><div style="word-break: break-word;"><div style="" class="lme-line-signal"><span style="white-space:nowrap;">From: </span><span style="white-space: nowrap;">&#34;JamesP&#34;&lt;<a data-mailto="mailto:pang.ju@roles.chat" class="quote-head-meta-mailto" style="overflow-wrap: break-word; white-space: pre-wrap; hyphens: none; word-break: break-word; cursor: pointer; text-decoration: none; color: inherit;" href="mailto:pang.ju@roles.chat">pang.ju@roles.chat</a>&gt;</span></div><div style="" class="lme-line-signal"><span style="white-space:nowrap;">Date: </span> Fri, Mar 1, 2024, 22:43</div><div style="" class="lme-line-signal"><span style="white-space:nowrap;">Subject: </span> sfddsf</div><div style="" class="lme-line-signal"><span style="white-space:nowrap;">To: </span><span style="white-space: nowrap;"><span>&#34;<a href="mailto:ddsfskldfjds+334rfgg@call.botlet.io" target="_blank" ref="noopener noreferrer">ddsfskldfjds+334rfgg@call.botlet.io</a>&#34;&lt;</span><a data-mailto="mailto:ddsfskldfjds+334rfgg@call.botlet.io" class="quote-head-meta-mailto" style="overflow-wrap: break-word; white-space: pre-wrap; hyphens: none; word-break: break-word; cursor: pointer; text-decoration: none; color: inherit;" href="mailto:ddsfskldfjds+334rfgg@call.botlet.io">ddsfskldfjds+334rfgg@call.botlet.io</a>&gt;</span></div></div></div></div><div><div style="word-break:break-word" id="editor_version_7.11.5_M5jkMrcg"><div style="margin-top:4px;margin-bottom:4px;line-height:1.6"><div style="font-size:14px" dir="auto" class="lme-line-signal"><a rel="nofollow noopener noreferrer" style="transition:color 0.3s ease 0s;cursor:pointer;text-decoration:none;color:rgb(20, 86, 240)" href="mailto:ddsfskldfjds+334rfgg@call.botlet.io" class="not-doclink">S</a>dfsdfsdfdsvbbf df</div></div></div></div></div></div></div></div></body></html>',
      StrippedTextReply:
        'Sdfsdf <a href="dfd">sddfds</a>\nAppController\n\nddsfskldfjds+334rfgg@call.botlet.io\n\n\nsdf',
      Tag: '',
      Headers: [
        { Name: 'Return-Path', Value: '<pang.ju@roles.chat>' },
        {
          Name: 'Received',
          Value:
            'by p-pm-inboundg03c-aws-useast1c.inbound.postmarkapp.com (Postfix, from userid 996)\tid 9921A4052B9; Fri,  1 Mar 2024 14:46:15 +0000 (UTC)',
        },
        {
          Name: 'X-Spam-Checker-Version',
          Value:
            'SpamAssassin 3.4.0 (2014-02-07) on\tp-pm-inboundg03c-aws-useast1c',
        },
        { Name: 'X-Spam-Status', Value: 'No' },
        { Name: 'X-Spam-Score', Value: '-0.0' },
        {
          Name: 'X-Spam-Tests',
          Value:
            'DKIM_SIGNED,DKIM_VALID,HTML_MESSAGE,RCVD_IN_ZEN_BLOCKED_OPENDNS,\tSPF_HELO_NONE,SPF_PASS,T_SCC_BODY_TEXT_LINE,URIBL_DBL_BLOCKED_OPENDNS,\tURIBL_ZEN_BLOCKED_OPENDNS',
        },
        {
          Name: 'Received-SPF',
          Value:
            "pass (roles.chat: Sender is authorized to use 'pang.ju@roles.chat' in 'mfrom' identity (mechanism 'include:_netblocks.m.feishu.cn' matched)) receiver=p-pm-inboundg03c-aws-useast1c; identity=mailfrom; envelope-from=\"pang.ju@roles.chat\"; helo=va-1-15.ptr.blmpb.com; client-ip=209.127.230.15",
        },
        {
          Name: 'Received',
          Value:
            'from va-1-15.ptr.blmpb.com (va-1-15.ptr.blmpb.com [209.127.230.15])\t(using TLSv1.2 with cipher ECDHE-RSA-AES128-GCM-SHA256 (128/128 bits))\t(No client certificate requested)\tby p-pm-inboundg03c-aws-useast1c.inbound.postmarkapp.com (Postfix) with ESMTPS id E14E9405106\tfor <ddsfskldfjds+334rfgg@call.botlet.io>; Fri,  1 Mar 2024 14:46:14 +0000 (UTC)',
        },
        {
          Name: 'DKIM-Signature',
          Value:
            'v=1; a=rsa-sha256; q=dns/txt; c=relaxed/relaxed; s=s1; d=roles-chat.20200927.dkim.feishu.cn; t=1709304369;  h=from:subject:mime-version:from:date:message-id:subject:to:cc: reply-to:content-type:mime-version:in-reply-to:message-id; bh=a15MvT8ivxkZjcqYjvMgzEbDMdmDpehIkoB9y/m4eLU=; b=AZb/VdLuQXeDShxHhCJXnu0F18wIPXMNH2qIuyBKSOiksPhaDWgHXTPGeQ7GPak5U9zr7N 7tZWyxqR7xtmdHqArxZMq6qAHKY2y3BGgZpQVN2xFALzH9oz7eT0/+1He11n2IXSVcuqBV Nu0KHxP+pX2UhuJfj78gFmOOQ/d8htBiaIqMcQJFIMWhOKh+aO3NV9xtjHlcryr8xp7ba1 CQ2TstmPJoxwgXSuKV5GJ9bTBHGcLwcXji8+kKlOvSdjghGJ269hrtbslJ1fD49ivRcvDs 4tvXTyon4bsX9bqDs6C4YF/Y1wrx5bp28dmfp84nMPDpOYFGln3icOZHMBl4Vg==',
        },
        {
          Name: 'In-Reply-To',
          Value:
            '<41158e7233075aeb6407512c20ae271901afcd14.65806463.2cb7.417b.8e55.5c47d139a2e8@feishu.cn>',
        },
        {
          Name: 'References',
          Value:
            '<41158e7233075aeb6407512c20ae271901afcd14.65806463.2cb7.417b.8e55.5c47d139a2e8@feishu.cn>',
        },
        {
          Name: 'Message-Id',
          Value:
            '<41158e7233075aeb6407512c20ae271901afcd14.8fbdff92.86c5.42e7.92e9.eef203910296@feishu.cn>',
        },
        { Name: 'Mime-Version', Value: '1.0' },
        {
          Name: 'X-Lms-Return-Path',
          Value: '<lba+165e1ea30+c7f73a+call.botlet.io+pang.ju@roles.chat>',
        },
      ],
      Attachments: [],
    };
    return this.appService.getHello();
  }
}
