import { IsString, MinLength } from 'class-validator'

export class LinkSteamProfileDto {
  // SteamID64, /profiles/<steamid>, /id/<vanity> URL 모두 한 입력 칸에서 받습니다.
  @IsString()
  @MinLength(2)
  steamProfile!: string
}
