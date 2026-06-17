import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { DemoSeedService } from './database/demo-seed.service';
import { PgvectorSetupService } from './database/pgvector-setup.service';
import { PostsModule } from './posts/posts.module';

function buildPostgresConfig(config: ConfigService) {
  const parsedUrl = parsePostgresUrl(config.getOrThrow<string>('DATABASE_HOST'));
  const sslEnabled =
    parsedUrl?.ssl === true || config.get<string>('DATABASE_SSL') === 'true';

  return {
    type: 'postgres' as const,
    host: parsedUrl?.host ?? config.getOrThrow<string>('DATABASE_HOST'),
    port: parsedUrl?.port ?? Number(config.getOrThrow<string>('DATABASE_PORT')),
    username: parsedUrl?.username ?? config.getOrThrow<string>('DATABASE_USER'),
    password: parsedUrl?.password ?? config.getOrThrow<string>('DATABASE_PASSWORD'),
    database: parsedUrl?.database ?? config.getOrThrow<string>('DATABASE_NAME'),
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
    autoLoadEntities: true,
    synchronize: true,
  };
}

function parsePostgresUrl(value: string) {
  if (!value.startsWith('postgres://') && !value.startsWith('postgresql://')) {
    return null;
  }

  const url = new URL(value);
  const sslMode = url.searchParams.get('sslmode');

  return {
    database: url.pathname.replace(/^\/+/, ''),
    host: url.hostname,
    password: decodeURIComponent(url.password),
    port: url.port ? Number(url.port) : 5432,
    ssl: Boolean(sslMode && sslMode !== 'disable'),
    username: decodeURIComponent(url.username),
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: buildPostgresConfig,
    }),
    AiModule,
    AuthModule,
    PostsModule,
  ],
  providers: [PgvectorSetupService, DemoSeedService],
})
export class AppModule {}
