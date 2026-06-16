import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export default class CreateTagDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name!: string;
}
