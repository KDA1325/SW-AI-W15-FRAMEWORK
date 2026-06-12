import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ArchivePost } from './archivePost.entity';
import { Recommendation } from './recommendation.entity';
import { UserGame } from './userGame.entity';

// 게임 마스터 데이터 테이블입니다.
// 리뷰/저널/추천/UserGame은 모두 이 Game을 참조합니다.
@Entity('Game')
export class Game {
  // 내부 DB 식별자는 uuid로 둡니다.
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Steam에서 가져온 게임이면 steamAppId가 들어갑니다.
  // 외부 API ID는 중복되면 안 되므로 unique를 둡니다. 아직 모르는 게임은 null일 수 있습니다.
  @Column({ nullable: true, unique: true })
  steamAppId!: string | null;

  // IGDB 같은 다른 게임 DB 연동을 고려한 외부 ID입니다.
  @Column({ nullable: true, unique: true })
  igdbId!: string | null;

  // 사용자에게 보이는 게임 제목입니다.
  @Column()
  title!: string;

  // 표지 이미지 URL입니다. 이미지가 없을 수 있어서 nullable입니다.
  @Column({ nullable: true })
  imageUrl!: string | null;

  // 게임 설명은 길 수 있으므로 varchar 기본값 대신 text 타입을 씁니다.
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  // 장르는 간단한 문자열 배열로 저장합니다. 예: ['RPG', 'Action']
  @Column('text', { array: true, default: [] })
  genres!: string[];

  // 지원 플랫폼 목록입니다. 예: ['PC', 'Steam Deck']
  @Column('text', { array: true, default: [] })
  platforms!: string[];

  // 추천/RAG에 쓸 수 있는 자유 태그입니다.
  @Column('text', { array: true, default: [] })
  tags!: string[];

  // 이 게임을 사용자가 얼마나 플레이했는지 나타내는 연결 테이블의 역방향 관계입니다.
  @OneToMany(() => UserGame, (userGame) => userGame.game)
  userGames!: UserGame[];

  // 이 게임에 달린 리뷰/저널 목록입니다.
  @OneToMany(() => ArchivePost, (post) => post.game)
  archivePosts!: ArchivePost[];

  // 이 게임이 추천 결과로 등장한 이력입니다.
  @OneToMany(() => Recommendation, (recommendation) => recommendation.game)
  recommendations!: Recommendation[];

  // 게임 데이터가 DB에 처음 들어온 시각입니다.
  @CreateDateColumn()
  createdAt!: Date;

  // 외부 API 동기화 등으로 게임 정보가 바뀐 시각입니다.
  @UpdateDateColumn()
  updatedAt!: Date;
}
