import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Comment } from './comment.entity';
import { Game } from '../../auth/entities/game.entity';
import { User } from '../../auth/entities/user.entity';

// 리뷰와 저널을 하나의 ArchivePost 테이블에 함께 저장하기 위한 구분값입니다.
// 문자열 enum으로 두면 DB와 API 응답에서 REVIEW/JOURNAL처럼 읽기 쉬운 값이 저장됩니다.
export enum ArchivePostType {
  REVIEW = 'REVIEW',
  JOURNAL = 'JOURNAL',
}

// ArchivePost는 리뷰와 저널을 합친 게시글 테이블입니다.
// rating은 REVIEW일 때만 사용하고 JOURNAL일 때는 null로 둡니다.
@Entity('ArchivePost')
export class ArchivePost {
  // 게시글 기본키입니다.
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // 작성자 User의 id입니다.
  @Column('uuid')
  userId!: string;

  // 게시글이 다루는 Game의 id입니다.
  @Column('uuid')
  gameId!: string;

  // REVIEW/JOURNAL 외의 값이 들어가지 않도록 enum 타입으로 제한합니다.
  @Column({ type: 'enum', enum: ArchivePostType })
  type!: ArchivePostType;

  // 리뷰 제목 또는 저널 제목입니다.
  @Column()
  title!: string;

  // 본문은 길어질 수 있으므로 text 타입을 사용합니다.
  @Column({ type: 'text' })
  content!: string;

  // 리뷰 평점입니다. 저널은 평점이 없으므로 nullable입니다.
  // 비즈니스 규칙상 type이 REVIEW일 때만 값을 넣도록 서비스 계층에서 검증하면 됩니다.
  @Column({ type: 'float', nullable: true })
  rating!: number | null;

  // 여러 게시글은 하나의 User 작성자를 가질 수 있습니다.
  @ManyToOne(() => User, (user) => user.archivePosts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  // 여러 게시글은 하나의 Game에 속할 수 있습니다.
  @ManyToOne(() => Game, (game) => game.archivePosts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' })
  game!: Game;

  // 게시글 하나에는 댓글이 여러 개 달릴 수 있습니다.
  // 실제 외래키는 Comment.postId에 있습니다.
  @OneToMany(() => Comment, (comment) => comment.post)
  comments!: Comment[];

  // 게시글 작성 시각입니다.
  @CreateDateColumn()
  createdAt!: Date;

  // 게시글 수정 시각입니다.
  @UpdateDateColumn()
  updatedAt!: Date;
}
