import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Game } from './game.entity';
import { User } from './user.entity';

// Recommendation은 특정 사용자에게 특정 게임을 추천한 결과를 저장합니다.
// 추천 목록을 다시 보여주거나 추천 사유를 추적할 때 사용합니다.
@Entity('Recommendation')
export class Recommendation {
  // 추천 결과 기본키입니다.
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // 추천을 받은 사용자 id입니다.
  @Column('uuid')
  userId!: string;

  // 추천된 게임 id입니다.
  @Column('uuid')
  gameId!: string;

  // 사용자에게 보여줄 추천 이유입니다.
  @Column({ type: 'text' })
  reason!: string;

  // 추천 점수입니다. 모델/룰 기반 점수를 소수로 저장할 수 있게 float를 사용합니다.
  @Column({ type: 'float' })
  score!: number;

  // 추천 목록 내 순위입니다. 화면에서 정렬 기준으로 바로 쓸 수 있습니다.
  @Column({ type: 'int' })
  rank!: number;

  // 여러 추천 결과는 하나의 User에 속합니다.
  @ManyToOne(() => User, (user) => user.recommendations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: User;

  // 여러 추천 결과는 하나의 Game을 가리킬 수 있습니다.
  @ManyToOne(() => Game, (game) => game.recommendations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'gameId' })
  game!: Game;

  // 추천 결과가 생성된 시각입니다. 이 테이블은 이력 성격이라 updatedAt은 두지 않았습니다.
  @CreateDateColumn()
  createdAt!: Date;
}
