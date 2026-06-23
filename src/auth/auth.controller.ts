// src/auth/auth.controller.ts  (Phase 1 — adds forgot-password / reset-password)
// Replace your existing auth.controller.ts with this file.
// Only the two new routes at the bottom are additions — everything else is unchanged.

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  Get,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response, Request } from 'express';

import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiResponse as AppResponse } from '../common/response/api-response';
import { PasswordResetService } from './password-reset.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private passwordResetService: PasswordResetService,
  ) {}

  @Public()
  @Post('signup')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new user' })
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.signup(dto);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return AppResponse.success(
      { user: result.user, accessToken: result.accessToken },
      'Account created successfully',
    );
  }

  @Public()
  @Post('login')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return AppResponse.success(
      { user: result.user, accessToken: result.accessToken },
      'Logged in successfully',
    );
  }

  @Public()
  @Post('demo-login')
  @Throttle({ short: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with demo credentials' })
  async demoLogin(@Res({ passthrough: true }) res: Response) {
    const result = await this.authService.demoLogin();
    this.setRefreshTokenCookie(res, result.refreshToken);
    return AppResponse.success(
      { user: result.user, accessToken: result.accessToken },
      'Demo login successful',
    );
  }

@Public()
@Post('refresh')
@Throttle({ short: { limit: 20, ttl: 60000 } })
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Refresh access token' })
async refresh(
  @Req() req: Request,
  @Res({ passthrough: true }) res: Response,
) {
  const refreshToken = req.cookies?.refresh_token;

  if (!refreshToken) {
    throw new UnauthorizedException('Refresh token is missing');
  }

  // We need userId to lookup in Redis. 
  // Option A (Recommended): Send userId in body (from frontend localStorage/context)
  const userId = req.body?.userId;

  if (!userId) {
    throw new UnauthorizedException('User ID is required for refresh');
  }

  const tokens = await this.authService.refreshTokens(userId, refreshToken);

  this.setRefreshTokenCookie(res, tokens.refreshToken);

  return AppResponse.success(
    { accessToken: tokens.accessToken },
    'Token refreshed successfully'
  );
}

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  async logout(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    return this.authService.logout(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  async getMe(@CurrentUser() user: any) {
    return AppResponse.success(user, 'Profile retrieved');
  }

  // ── NEW: Forgot password ────────────────────────────────────────────────────

  /**
   * POST /auth/forgot-password
   * User submits their email. We send a reset link if the account exists.
   * Rate limited to 3 requests per 15 minutes per IP to prevent abuse.
   */
  @Public()
  @Post('forgot-password')
  @Throttle({ short: { limit: 3, ttl: 15 * 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const result = await this.passwordResetService.requestReset(dto.email);
    return AppResponse.success(result, result.message);
  }

  /**
   * POST /auth/reset-password
   * User submits the token (from email) and their new password.
   */
  @Public()
  @Post('reset-password')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token from email' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid, expired, or already-used token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const result = await this.passwordResetService.resetPassword(
      dto.token,
      dto.password,
    );
    return AppResponse.success(result, result.message);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private setRefreshTokenCookie(res: Response, token: string) {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });
  }
}
