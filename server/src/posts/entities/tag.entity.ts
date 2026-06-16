import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ArchivePost } from './archivePost.entity';

// 자유 태그 마스터 테이블입니다.
// name은 사용자에게 보여줄 표시값이고, normalizedName은 중복 방지를 위한 비교값입니다.
@Entity('Tag')
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  // 같은 의미의 태그가 대소문자/공백/하이픈 차이로 중복 생성되지 않게 unique 기준으로 사용합니다.
  @Index('IDX_tag_normalized_name_unique', { unique: true })
  @Column()
  normalizedName!: string;

  // 여러 태그는 여러 게시글에 붙을 수 있으므로 ArchivePost와 다대다 관계를 맺습니다.
  @ManyToMany(() => ArchivePost, (post) => post.tags)
  posts!: ArchivePost[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
