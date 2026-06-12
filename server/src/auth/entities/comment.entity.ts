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
import { ArchivePost } from './archivePost.entity';
import { User } from './user.entity';

// 댓글 테이블입니다.
// 모든 댓글은 ArchivePost 하나에 속하고, parentCommentId를 통해 대댓글 구조를 만들 수 있습니다.
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

  // 부모 댓글 id입니다.
  // 최상위 댓글은 부모가 없으므로 null이고, 대댓글은 부모 댓글의 id를 가집니다.
  @Column('uuid', { nullable: true })
  parentCommentId!: string | null;

  // 댓글 본문입니다. 길이를 넉넉히 받기 위해 text 타입을 사용합니다.
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
  // 사용자가 삭제되면 그 사용자가 작성한 댓글도 함께 삭제됩니다.
  @ManyToOne(() => User, (user) => user.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  // 댓글이 자기 자신과 연결되는 self relation입니다.
  // 여러 대댓글이 하나의 부모 댓글에 속할 수 있으므로 ManyToOne을 사용합니다.
  // nullable: true는 최상위 댓글처럼 부모가 없는 댓글을 허용한다는 뜻입니다.
  @ManyToOne(() => Comment, (comment) => comment.replies, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parentCommentId' })
  parentComment!: Comment | null;

  // 이 댓글을 부모로 가지는 대댓글 목록입니다.
  // 실제 외래키는 자식 댓글의 parentCommentId 컬럼에 있습니다.
  @OneToMany(() => Comment, (comment) => comment.parentComment)
  replies!: Comment[];

  // 댓글 작성 시각입니다.
  @CreateDateColumn()
  createdAt!: Date;

  // 댓글 수정 시각입니다.
  @UpdateDateColumn()
  updatedAt!: Date;
}
