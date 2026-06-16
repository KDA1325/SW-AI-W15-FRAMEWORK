import { Test, TestingModule } from '@nestjs/testing'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { SteamService } from './steam.service'

describe('AuthController', () => {
  let controller: AuthController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            logout: jest.fn(),
            me: jest.fn(),
            updateProfile: jest.fn(),
          },
        },
        {
          provide: SteamService,
          useValue: {
            buildOpenIdLoginUrl: jest.fn(),
            getLinkedProfile: jest.fn(),
            linkOpenIdProfile: jest.fn(),
            linkProfile: jest.fn(),
            profileRedirectUrl: jest.fn(),
            unlinkProfile: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get<AuthController>(AuthController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
