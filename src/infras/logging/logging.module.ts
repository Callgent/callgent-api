import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import * as path from 'path';
import pino from 'pino';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const currentFile = __filename;
        const dir = path.dirname(currentFile);
        const fileExtension = path.extname(currentFile);
        return {
          pinoHttp: {
            level: config.get('LOG_LEVEL', 'debug'),
            transport: {
              target: dir + '/pino-pretty-transport' + fileExtension,
              options: {
                colorize: true,
                relativeTime: true,
                translateTime: 'yy-mm-dd HH:MM:ss',
                ignore: 'pid,hostname,context,req,res,err,responseTime',
                levelFirst: true,
                singleLine: true,
              },
            },
            stream: pino.destination({
              dest: config.get('LOG_FILE_PATH'),
              minLength: config.get('LOG_BUFFER_LENGTH'),
              sync: false, // Asynchronous logging
            }),
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class LoggingModule {}
