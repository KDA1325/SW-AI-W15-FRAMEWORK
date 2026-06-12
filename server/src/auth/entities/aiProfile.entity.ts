import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

// AiProfile은 사용자의 플레이 기록/리뷰/저널을 분석해서 만든 AI용 취향 프로필입니다.
// 추천이나 RAG 검색의 입력 데이터로 사용할 수 있습니다.
@Entity('AiProfile')
export class AiProfile {
  // AI 프로필 기본키입니다.
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // 사용자 1명당 AI 프로필 1개만 허용하기 위해 unique를 둡니다.
  @Column('uuid', { unique: true })
  userId!: string;

  // 사용자의 플레이 스타일을 자연어로 요약한 문장입니다.
  @Column({ type: 'text', nullable: true })
  playStyleSummary!: string | null;

  // AI가 추출한 선호 키워드 목록입니다.
  @Column('text', { array: true, default: [] })
  favoriteKeywords!: string[];

  // AI가 추출한 선호 장르 목록입니다.
  @Column('text', { array: true, default: [] })
  favoriteGenres!: string[];

  // 마지막 분석 시각입니다. 아직 분석 전이면 null입니다.
  @Column({ type: 'timestamptz', nullable: true })
  lastAnalyzedAt!: Date | null;

  // AiProfile은 User와 1:1 관계입니다.
  // JoinColumn이 있는 쪽이 실제 외래키(userId)를 가진 owner 쪽입니다.
  @OneToOne(() => User, (user) => user.aiProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  // AI 프로필 생성 시각입니다.
  @CreateDateColumn()
  createdAt!: Date;

  // 분석 결과가 갱신된 시각입니다.
  @UpdateDateColumn()
  updatedAt!: Date;
}
