import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Game } from './game.entity';
import { User } from './user.entity';

// UserGame은 User와 Game 사이의 관계 테이블입니다.
// 단순 다대다 JoinTable이 아니라 playtime/achievement 같은 추가 정보를 저장해야 해서 별도 엔티티로 둡니다.
@Entity('UserGame')
export class UserGame {
  // 관계 레코드 자체의 기본키입니다.
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // User 테이블을 가리키는 외래키 컬럼입니다.
  // relation 필드(user)와 별개로 id만 빠르게 쓸 수 있게 명시합니다.
  @Column('uuid')
  userId!: string;

  // Game 테이블을 가리키는 외래키 컬럼입니다.
  @Column('uuid')
  gameId!: string;

  // 전체 플레이 시간입니다. 없으면 0분으로 시작합니다.
  @Column({ type: 'int', default: 0 })
  totalPlaytimeMinutes!: number;

  // 최근 기간 플레이 시간입니다. 추천 분석에서 최근 취향 가중치로 쓸 수 있습니다.
  @Column({ type: 'int', default: 0 })
  recentPlaytimeMinutes!: number;

  // 도전과제 달성률입니다. 0~100 같은 실수 값이 될 수 있어 float로 둡니다.
  @Column({ type: 'float', nullable: true })
  achievementRate!: number | null;

  // 마지막 플레이 시각은 시간대 정보를 잃지 않도록 timestamptz를 사용합니다.
  @Column({ type: 'timestamptz', nullable: true })
  lastPlayedAt!: Date | null;

  // 여러 UserGame 레코드가 하나의 User에 속합니다.
  // onDelete: 'CASCADE'는 사용자가 삭제되면 연결된 플레이 기록도 함께 삭제한다는 뜻입니다.
  @ManyToOne(() => User, (user) => user.userGames, { onDelete: 'CASCADE' })
  // JoinColumn으로 이 관계가 userId 컬럼을 외래키로 사용한다고 명시합니다.
  @JoinColumn({ name: 'userId' })
  user!: User;

  // 여러 UserGame 레코드가 하나의 Game에 속합니다.
  @ManyToOne(() => Game, (game) => game.userGames, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' })
  game!: Game;

  // 플레이 기록이 처음 생성된 시각입니다.
  @CreateDateColumn()
  createdAt!: Date;

  // 플레이 시간/도전과제/최근 플레이 시각이 갱신된 시각입니다.
  @UpdateDateColumn()
  updatedAt!: Date;
}
