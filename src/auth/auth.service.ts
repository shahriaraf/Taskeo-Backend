import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import * as bcrypt from 'bcrypt';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { v4 as uuidv4 } from 'uuid';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { ActivityAction } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
    private activityLogsService: ActivityLogsService,
  ) {}

  async signup(dto: SignupDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        passwordHash,
        role: dto.role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    await this.activityLogsService.log({
      userId: user.id,
      action: ActivityAction.PROJECT_CREATED,
      entityType: 'user',
      entityId: user.id,
      metadata: { userName: user.name },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return { user, ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.isActive) {
      // Use a consistent error message to prevent user enumeration attacks.
      // Never say "user not found" vs "wrong password" separately.
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      ...tokens,
    };
  }

  async demoLogin() {
    const demoEmail = 'admin@demo.com';
    const user = await this.prisma.user.findUnique({
      where: { email: demoEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Demo account not found');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      ...tokens,
    };
  }

  /**
   * Refresh token rotation:
   * 1. Verify the incoming refresh token exists in Redis for this user.
   * 2. Immediately delete it (one-time use — prevents replay attacks).
   * 3. Issue a brand-new access token AND a brand-new refresh token.
   * 4. Store the new refresh token in Redis.
   *
   * This means if an attacker steals a refresh token and uses it first,
   * the legitimate user's next refresh will fail and they will be logged out —
   * alerting them that something is wrong.
   */
async refreshTokens(userId: string, incomingRefreshToken: string) {
  const storedToken = await this.redisService.getRefreshToken(userId);

  if (!storedToken) {
    this.logger.warn(`No refresh token found for user ${userId}`);
    throw new UnauthorizedException('Invalid or expired refresh token. Please log in again.');
  }

  if (storedToken !== incomingRefreshToken) {
    // Possible replay or multiple tabs/devices — invalidate
    await this.redisService.deleteRefreshToken(userId);
    this.logger.warn(`Suspicious refresh attempt for user ${userId}. Session invalidated.`);
    throw new UnauthorizedException('Invalid or expired refresh token. Please log in again.');
  }

  // Rest of your code remains the same...
  await this.redisService.deleteRefreshToken(userId);

  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedException('User not found or inactive');
  }

  const tokens = await this.generateTokens(user.id, user.email, user.role);
  return tokens;
}

  async logout(userId: string) {
    // Delete the refresh token from Redis so it cannot be reused
    await this.redisService.deleteRefreshToken(userId);
    return { message: 'Logged out successfully' };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload: JwtPayload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: this.configService.get<number>('jwt.accessExpiresIn') ?? '15m',
      }),
      uuidv4(), // Opaque, high-entropy refresh token (not a JWT — cannot be decoded)
    ]);

    const refreshTtl = 7 * 24 * 60 * 60; // 7 days in seconds
    await this.redisService.storeRefreshToken(userId, refreshToken, refreshTtl);

    return { accessToken, refreshToken };
  }
}
