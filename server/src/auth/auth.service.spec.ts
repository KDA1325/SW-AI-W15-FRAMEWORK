import { BadRequestException } from '@nestjs/common'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { AuthService } from './auth.service'
import { PROFILE_IMAGE_UPLOAD_DIR } from './profile-image'

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

  it('stores uploaded profile images and returns the public image path', async () => {
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

    const result = await service.updateProfileImage('user-id', {
      buffer: Buffer.from([137, 80, 78, 71]),
      mimetype: 'image/png',
      originalname: 'avatar.png',
      size: 4,
    })

    expect(result.profileImageUrl).toMatch(
      /^\/uploads\/profile-images\/user-id-/,
    )
    expect(result.profileImageUrl).toMatch(/\.png$/)
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        profileImageUrl: result.profileImageUrl,
      }),
    )

    const fileName = result.profileImageUrl.split('/').at(-1)

    expect(fileName).toBeTruthy()

    const filePath = join(PROFILE_IMAGE_UPLOAD_DIR, fileName!)
    expect(existsSync(filePath)).toBe(true)
    await rm(filePath, { force: true })
  })
})
