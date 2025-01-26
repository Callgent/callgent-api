import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import path from 'path';
import { Utils } from '../infras/libs/utils';
import { InvokeSubprocess } from './invoke.subprocess';
import { spawnSync } from 'child_process';

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
    const cwd = path.join(process.cwd(), './templates/task-runner/');
    const pipePath = path.join(cwd, 'pipe.socket');
    console.log(cwd);

    const server = await service.createNamedPipe(pipePath, {
      onConnect: async () => {
        console.log('connected');
      },
      onLine: (line) => {
        console.log('pipe data:', line);
      },
    });

    try {
      const p = spawnSync('pnpm', ['install'], { cwd });
      // (service as any).logger = { ...console };
      console.log(p.stdout.toString(), p.stderr.toString());
      const child = await service.spawnOrRestore(
        'npx',
        ['tsx', 'index.ts', 'test'],
        { cwd },
      );
      await service.waitForExit(child);
      await Utils.sleep(1000);
      expect(child.pid).toBeGreaterThan(0);
    } finally {
      server.close();
    }
  }, 500000);
});
