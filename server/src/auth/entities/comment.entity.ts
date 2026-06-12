import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ArchivePost } from './archivePost.entity';
import { User } from './user.entity';

// 댓글 테이블입니다.
// 현재 설계에서는 모든 댓글이 ArchivePost 하나에 속합니다.
@Entity('Comment')
export class Comment {
  // 댓글 기본키입니다.
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // 댓글이 달린 게시글 id입니다.
  @Column('uuid')
  postId!: string;

  // 댓글 작성자 id입니다.
  @Column('uuid')
  userId!: string;

  // 댓글 본문입니다. 길이를 넉넉히 받기 위해 text를 사용합니다.
  @Column({ type: 'text' })
  content!: string;

  // 여러 댓글은 하나의 게시글에 속합니다.
  // 게시글이 삭제되면 댓글도 함께 삭제되도록 CASCADE를 둡니다.
  @ManyToOne(() => ArchivePost, (post) => post.comments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'postId' })
  post!: ArchivePost;

  // 여러 댓글은 하나의 작성자 User에 속합니다.
  @ManyToOne(() => User, (user) => user.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  // 댓글 작성 시각입니다.
  @CreateDateColumn()
  createdAt!: Date;

  // 댓글 수정 시각입니다.
  @UpdateDateColumn()
  updatedAt!: Date;
}
