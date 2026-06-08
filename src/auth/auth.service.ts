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
    // Check duplicate email
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create user
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

    // Log activity
    await this.activityLogsService.log({
      userId: user.id,
      action: ActivityAction.PROJECT_CREATED, // Reuse or add USER_REGISTERED
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
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
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

  async refreshTokens(userId: string, refreshToken: string) {
    const storedToken = await this.redisService.getRefreshToken(userId);

    if (!storedToken || storedToken !== refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

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
    await this.redisService.deleteRefreshToken(userId);
    return { message: 'Logged out successfully' };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload: JwtPayload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: this.configService.get<number>('jwt.accessExpiresIn') ?? '15m',
      }),
      uuidv4(), // Opaque refresh token
    ]);
    // Store refresh token in Redis
    const refreshTtl = 7 * 24 * 60 * 60; // 7 days in seconds
    await this.redisService.storeRefreshToken(userId, refreshToken, refreshTtl);

    return { accessToken, refreshToken };
  }
}