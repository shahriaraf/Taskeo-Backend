import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../src/auth/auth.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../src/common/redis/redis.service';
import { ActivityLogsService } from '../../src/activity-logs/activity-logs.service';
import * as bcrypt from 'bcrypt';

// ── Mocks ────────────────────────────────────────────
const mockUser = {
  id: 'user-uuid-1',
  name: 'John Doe',
  email: 'john@example.com',
  passwordHash: '$2b$12$hashedpassword',
  role: 'team_member',
  avatarUrl: null,
  isActive: true,
  lastLogin: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockJwtService = {
  signAsync: jest.fn().mockResolvedValue('mock.jwt.token'),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('15m'),
};

const mockRedisService = {
  storeRefreshToken: jest.fn().mockResolvedValue(undefined),
  getRefreshToken: jest.fn(),
  deleteRefreshToken: jest.fn().mockResolvedValue(undefined),
};

const mockActivityLogsService = {
  log: jest.fn().mockResolvedValue(undefined),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: ActivityLogsService, useValue: mockActivityLogsService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ── signup ────────────────────────────────────────
  describe('signup', () => {
    it('should create a new user and return tokens', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null); // No existing user
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      const dto = { name: 'John Doe', email: 'john@example.com', password: 'password123', role: 'team_member' as any };
      const result = await service.signup(dto);

      expect(result.user).toBeDefined();
      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.refreshToken).toBeDefined();
      expect(mockPrismaService.user.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const dto = { name: 'John', email: 'john@example.com', password: 'password123', role: 'team_member' as any };

      await expect(service.signup(dto)).rejects.toThrow(ConflictException);
    });

    it('should lowercase the email before saving', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({ ...mockUser, email: 'john@example.com' });

      const dto = { name: 'John', email: 'JOHN@EXAMPLE.COM', password: 'pass', role: 'team_member' as any };
      await service.signup(dto);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'john@example.com' }),
        }),
      );
    });
  });

  // ── login ─────────────────────────────────────────
  describe('login', () => {
    it('should return user and tokens on valid credentials', async () => {
      const hash = await bcrypt.hash('correctpassword', 12);
      mockPrismaService.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash: hash });
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.login({ email: 'john@example.com', password: 'correctpassword' });

      expect(result.user.email).toBe('john@example.com');
      expect(result.accessToken).toBeDefined();
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hash = await bcrypt.hash('correctpassword', 12);
      mockPrismaService.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash: hash });

      await expect(
        service.login({ email: 'john@example.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(
        service.login({ email: 'john@example.com', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── refreshTokens ─────────────────────────────────
  describe('refreshTokens', () => {
    it('should return new tokens when refresh token is valid', async () => {
      const storedToken = 'valid-refresh-token-uuid';
      mockRedisService.getRefreshToken.mockResolvedValue(storedToken);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.refreshTokens(mockUser.id, storedToken);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      // Old token should be deleted (rotation)
      expect(mockRedisService.deleteRefreshToken).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw UnauthorizedException when refresh token does not match', async () => {
      mockRedisService.getRefreshToken.mockResolvedValue('stored-token');

      await expect(
        service.refreshTokens(mockUser.id, 'different-token'),
      ).rejects.toThrow(UnauthorizedException);

      // Should invalidate the session on suspicious activity
      expect(mockRedisService.deleteRefreshToken).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when no token is stored', async () => {
      mockRedisService.getRefreshToken.mockResolvedValue(null);

      await expect(
        service.refreshTokens(mockUser.id, 'any-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── logout ────────────────────────────────────────
  describe('logout', () => {
    it('should delete the refresh token from Redis', async () => {
      await service.logout(mockUser.id);
      expect(mockRedisService.deleteRefreshToken).toHaveBeenCalledWith(mockUser.id);
    });
  });
});
