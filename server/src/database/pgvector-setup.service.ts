import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class PgvectorSetupService implements OnApplicationBootstrap {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    // TypeORM synchronize가 EmbeddingDocument 테이블을 만든 뒤 실행됩니다.
    // pgvector 확장과 embedding vector 컬럼은 TypeORM 엔티티가 아니라 raw SQL로 직접 관리합니다.
    await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    await this.dataSource.query(`
      ALTER TABLE "EmbeddingDocument"
      ADD COLUMN IF NOT EXISTS "embedding" vector(1536)
    `);

    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS "IDX_EmbeddingDocument_embedding_hnsw"
      ON "EmbeddingDocument"
      USING hnsw ("embedding" vector_cosine_ops)
    `);
  }
}
