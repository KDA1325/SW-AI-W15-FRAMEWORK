import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { DemoSeedService } from './database/demo-seed.service';
import { PgvectorSetupService } from './database/pgvector-setup.service';
import { PostsModule } from './posts/posts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow<string>('DATABASE_HOST'),
        port: Number(config.getOrThrow<string>('DATABASE_PORT')),
        username: config.getOrThrow<string>('DATABASE_USER'),
        password: config.getOrThrow<string>('DATABASE_PASSWORD'),
        database: config.getOrThrow<string>('DATABASE_NAME'),
        autoLoadEntities: true,

        // 개발 중에는 엔티티 기반 테이블을 자동 동기화합니다.
        // 운영에서는 synchronize 대신 migration 중심으로 전환해야 합니다.
        synchronize: true,

        // EmbeddingDocument.embedding은 TypeORM 엔티티 컬럼이 아니라
        // pgvector 전용 vector(1536) 컬럼으로 PgvectorSetupService에서 생성합니다.
      }),
    }),
    AuthModule,
    PostsModule,
  ],
  providers: [PgvectorSetupService, DemoSeedService],
})
export class AppModule {}
