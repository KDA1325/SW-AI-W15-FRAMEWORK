import { BadRequestException } from '@nestjs/common'
import { AuthService } from './auth.service'

describe('AuthService profile updates', () => {
  it('saves editable profile fields and normalizes gamer tags', async () => {
    const user = {
      bio: null,
      email: 'player@example.com',
      gamerTags: [],
      id: 'user-id',
      nickname: 'PLAYER',
      profileImageUrl: null,
      steamId: null,
    }
    const userRepository = {
      findOneBy: jest.fn().mockResolvedValue(user),
      save: jest.fn(async (value) => value),
    }
    const service = new AuthService(
      userRepository as never,
      {
        sign: jest.fn(),
      } as never,
    )

    const result = await service.updateProfile('user-id', {
      bio: '  Loves long-form RPG critique.  ',
      gamerTags: ['#hardcore gamer', 'hardcore-gamer', 'retro_pixel', ''],
      nickname: '  DEMO_PLAYER  ',
    })

    expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: 'user-id' })
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        bio: 'Loves long-form RPG critique.',
        gamerTags: ['HARDCORE_GAMER', 'RETRO_PIXEL'],
        nickname: 'DEMO_PLAYER',
      }),
    )
    expect(result).toEqual(
      expect.objectContaining({
        bio: 'Loves long-form RPG critique.',
        gamerTags: ['HARDCORE_GAMER', 'RETRO_PIXEL'],
        nickname: 'DEMO_PLAYER',
      }),
    )
    expect(result).not.toHaveProperty('passwordHash')
  })

  it('rejects blank nicknames after trimming', async () => {
    const userRepository = {
      findOneBy: jest.fn().mockResolvedValue({
        id: 'user-id',
        nickname: 'PLAYER',
      }),
      save: jest.fn(),
    }
    const service = new AuthService(
      userRepository as never,
      {
        sign: jest.fn(),
      } as never,
    )

    await expect(
      service.updateProfile('user-id', { nickname: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(userRepository.save).not.toHaveBeenCalled()
  })
})
