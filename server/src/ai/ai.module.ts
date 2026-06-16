import { Module } from '@nestjs/common';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';

@Module({
  controllers: [RagController],
  exports: [RagService],
  providers: [RagService],
})
export class AiModule {}
