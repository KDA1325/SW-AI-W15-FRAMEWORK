import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AiProfile } from './aiProfile.entity';
import { ArchivePost } from './archivePost.entity';
import { Comment } from './comment.entity';
import { Recommendation } from './recommendation.entity';
import { UserGame } from './userGame.entity';

// @Entity('User')는 이 클래스가 DB의 User 테이블과 매핑된다는 뜻입니다.
// 클래스 이름은 TypeScript에서 쓰는 이름이고, 괄호 안 문자열은 실제 테이블 이름입니다.
@Entity('User')
export class User {
  // uuid 기본키를 자동 생성합니다.
  // 숫자 id보다 노출/분산 환경에서 충돌 가능성이 낮아 사용자 식별자에 자주 씁니다.
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // unique: true는 같은 이메일로 두 번 가입하지 못하게 DB 레벨에서 막습니다.
  @Column({ unique: true })
  email!: string;

  // 실제 비밀번호가 아니라 bcrypt 등으로 해시한 값만 저장합니다.
  @Column()
  passwordHash!: string;

  // 화면에 표시할 사용자 이름입니다. 기존 name 대신 서비스 도메인 용어인 nickname을 사용합니다.
  @Column()
  nickname!: string;

  // bio는 사용자가 입력하지 않을 수 있으므로 nullable 컬럼으로 둡니다.
  // TypeScript 타입도 null을 포함해야 DB 값과 코드 타입이 맞습니다.
  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  // 프로필 이미지는 없는 사용자가 자연스러우므로 nullable입니다.
  // 기본 이미지는 DB에 저장하지 않고 프론트에서 fallback으로 처리하는 쪽이 단순합니다.
  @Column({ nullable: true })
  profileImageUrl!: string | null;

  // PostgreSQL의 text[] 배열 컬럼입니다.
  // gamerTags처럼 값 개수가 유동적인 짧은 문자열 목록은 별도 테이블 없이 배열로 시작해도 충분합니다.
  @Column('text', { array: true, default: [] })
  gamerTags!: string[];

  // Steam 계정 연동 전까지는 없을 수 있으므로 nullable입니다.
  @Column({ nullable: true })
  steamId!: string | null;

  // User 1명은 여러 UserGame 레코드를 가질 수 있습니다.
  // 실제 외래키는 UserGame.userId에 있고, 이 필드는 조회 편의를 위한 역방향 관계입니다.
  @OneToMany(() => UserGame, (userGame) => userGame.user)
  userGames!: UserGame[];

  // User 1명은 여러 리뷰/저널 글을 작성할 수 있습니다.
  @OneToMany(() => ArchivePost, (post) => post.user)
  archivePosts!: ArchivePost[];

  // User 1명은 여러 댓글을 작성할 수 있습니다.
  @OneToMany(() => Comment, (comment) => comment.user)
  comments!: Comment[];

  // AiProfile은 사용자별 분석 결과라 사용자 1명당 1개만 존재해야 합니다.
  // 실제 unique 제약은 AiProfile.userId에 둡니다.
  @OneToOne(() => AiProfile, (aiProfile) => aiProfile.user)
  aiProfile!: AiProfile | null;

  // User 1명에게 여러 게임 추천 결과가 쌓일 수 있습니다.
  @OneToMany(() => Recommendation, (recommendation) => recommendation.user)
  recommendations!: Recommendation[];

  // 생성 시각은 TypeORM이 insert 시 자동으로 채웁니다.
  @CreateDateColumn()
  createdAt!: Date;

  // 수정 시각은 TypeORM이 update 시 자동으로 갱신합니다.
  @UpdateDateColumn()
  updatedAt!: Date;
}
