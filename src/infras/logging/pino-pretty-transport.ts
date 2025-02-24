import pinoPretty from 'pino-pretty';

interface PrettyOptions {
  [key: string]: any;
}

export default (opts: PrettyOptions) => {
  return pinoPretty({
    ...opts,
    messageFormat: (log, messageKey) => {
      const { context, req, res, responseTime, err } = log;
      const contextInfo = context ? `\x1b[33m[${context}]\x1b[0m` : '';
      let reqInfo = '';
      if (req) {
        const { id, url, method } = req as any;
        reqInfo = ` ${id}#${method}:${url}`;
      }
      let resInfo: any = '';
      const statusCode = (res as any)?.statusCode;
      if (err && (!statusCode || statusCode > 499)) {
        resInfo = `\n\x1b[31m[ERROR ${
          statusCode || ''
        }]\x1b[0m ${JSON.stringify(
          {
            ...(err as any),
            stack: undefined,
            name: undefined,
            type: undefined,
            message: undefined,
          },
          null,
          2,
        )},\n${(err as any).stack}\n\n`;
      }
      const tsInfo = responseTime
        ? ` \x1b[33m[+${responseTime}ms code:${statusCode}]\x1b[0m`
        : '';
      return `${contextInfo}${tsInfo}\x1b[90m${reqInfo}\x1b[0m \x1b[32m${log[messageKey]}${resInfo}`;
    },
  });
};
