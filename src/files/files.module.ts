import { Global, Module } from '@nestjs/common';
import { FilesService } from './files.service';

@Global()
@Module({
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
