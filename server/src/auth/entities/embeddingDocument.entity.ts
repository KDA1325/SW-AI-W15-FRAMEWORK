import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// EmbeddingDocument가 어떤 원본 데이터를 임베딩한 것인지 구분합니다.
// sourceId만 있으면 어느 테이블의 id인지 알 수 없어서 sourceType이 함께 필요합니다.
export enum EmbeddingSourceType {
  GAME = 'GAME',
  ARCHIVE_POST = 'ARCHIVE_POST',
  AI_PROFILE = 'AI_PROFILE',
}

// 임베딩 검색용 문서 테이블입니다.
// Game, ArchivePost, AiProfile 원문을 벡터화해서 한 테이블에서 검색할 수 있게 모읍니다.
@Entity('EmbeddingDocument')
export class EmbeddingDocument {
  // 임베딩 문서 기본키입니다.
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // GAME / ARCHIVE_POST / AI_PROFILE 중 어떤 원본인지 나타냅니다.
  @Column({ type: 'enum', enum: EmbeddingSourceType })
  sourceType!: EmbeddingSourceType;

  // 원본 테이블의 id입니다.
  // sourceType과 sourceId를 함께 보면 "어느 테이블의 어떤 row를 임베딩했는지" 알 수 있습니다.
  @Column('uuid')
  sourceId!: string;

  // 실제 임베딩에 사용한 텍스트입니다.
  // 예: 게임 설명+장르+태그, 리뷰 제목+본문, AI 취향 요약 등.
  @Column({ type: 'text' })
  content!: string;

  // 임베딩 벡터입니다.
  // 이 필드는 TypeScript에서 값을 다루기 위한 타입 선언이고, TypeORM 컬럼으로 매핑하지 않습니다.
  // 실제 DB 컬럼은 migration raw SQL이 pgvector의 vector(1536) 타입으로 따로 만듭니다.
  // 이유: 현재 TypeORM 0.3.20은 @Column({ type: 'vector' })를 지원 타입으로 인식하지 못합니다.
  embedding!: number[];

  // 원본별 부가 정보를 유연하게 저장하기 위한 JSON 컬럼입니다.
  // 예: { title, gameId, model, dimensions } 같은 값을 넣을 수 있습니다.
  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  // 임베딩 문서 생성 시각입니다.
  @CreateDateColumn()
  createdAt!: Date;
}
