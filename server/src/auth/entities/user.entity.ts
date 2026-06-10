import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('User') // 생성될 DB 테이블 이름을 지정합니다.
export class User {
  @PrimaryGeneratedColumn('uuid') // @default(uuid())와 동일하게 자동으로 UUID를 생성하는 기본키입니다.
  id!: string;

  @Column({ unique: true }) // @unique와 동일하게 이메일 중복을 방지합니다.
  email!: string;

  @Column()
  name!: string;

  @Column()
  passwordHash!: string;

  @CreateDateColumn() // @default(now())와 같이 데이터가 생성될 때 시간이 자동 기록됩니다.
  createdAt!: Date;

  @UpdateDateColumn() // @updatedAt과 같이 데이터가 수정될 때 시간이 자동 갱신됩니다.
  updatedAt!: Date;
}
