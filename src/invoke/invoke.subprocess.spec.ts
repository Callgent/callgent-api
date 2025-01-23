import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import path from 'path';
import { Utils } from '../infras/libs/utils';
import { InvokeSubprocess } from './invoke.subprocess';

describe('InvokeSubprocess', () => {
  let service: InvokeSubprocess;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InvokeSubprocess, ConfigService],
    }).compile();

    service = module.get<InvokeSubprocess>(InvokeSubprocess);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('spawn a new subprocess', async () => {
    const cwd = path.join(process.cwd(), './test/e2e/data/invoke-subprocess/');
    const pipePath = path.join(cwd, 'pipe.socket');
    console.log(cwd);

    const server = service.createNamedPipe(pipePath, {
      onConnect: async (socket) => {
        console.log('connected');
      },
      onLine: async (data, socket) => {
        const msg = data.toString();
        console.log('data', msg);
      },
    });

    try {
      const child = await service.spawnOrRestore(
        'npx',
        ['tsx', 'index.ts', 'test'],
        { cwd },
      );
      expect(child.pid).toBeGreaterThan(0);
      await Utils.sleep(10000);
    } finally {
      server.close();
    }
  }, 50000);
});
