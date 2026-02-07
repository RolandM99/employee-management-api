import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { UsersService, User } from '@app/users';
import { MailQueueService } from '@app/mail';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly bcryptRounds: number;
  private readonly logger = new Logger(AuthService.name);
  private readonly resetTokenExpiryMinutes = 15;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailQueueService: MailQueueService,
  ) {
    this.bcryptRounds = 10;
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);

    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      role: dto.role,
    });

    return this.issueTokens(user);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return null;
    }

    return user;
  }

  async login(user: User): Promise<AuthResponseDto> {
    return this.issueTokens(user);
  }

  async refresh(userId: string, refreshToken: string): Promise<AuthResponseDto> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenDigest = this.sha256(refreshToken);
    const isValid = await bcrypt.compare(tokenDigest, user.refreshTokenHash);
    if (!isValid) {
      throw new ForbiddenException('Refresh token mismatch');
    }

    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.clearRefreshToken(userId);
  }

  async getProfile(
    userId: string,
  ): Promise<
    Omit<User, 'passwordHash' | 'refreshTokenHash' | 'resetTokenHash' | 'resetTokenExpiresAt'>
  > {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { passwordHash, refreshTokenHash, resetTokenHash, resetTokenExpiresAt, ...profile } =
      user;
    return profile;
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Always return success to prevent email enumeration
      return;
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.sha256(rawToken);
    const expiresAt = new Date(Date.now() + this.resetTokenExpiryMinutes * 60 * 1000);

    await this.usersService.updateResetToken(user.id, tokenHash, expiresAt);

    const resetUrl = `${this.configService.getOrThrow<string>('frontend.resetUrl')}?token=${rawToken}`;

    await this.mailQueueService.enqueueResetPasswordEmail({
      email: user.email,
      resetUrl,
    });
    this.logger.log(`Queued reset password email for ${user.email}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.sha256(token);

    // Find user by iterating is not ideal, but resetTokenHash is not indexed.
    // For production scale, consider adding an index or a separate token table.
    const user = await this.usersService.findByResetTokenHash(tokenHash);
    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
      // Clear expired token
      await this.usersService.updateResetToken(user.id, null, null);
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, this.bcryptRounds);
    await this.usersService.updatePassword(user.id, passwordHash);
    await this.usersService.updateResetToken(user.id, null, null);
    await this.usersService.clearRefreshToken(user.id);
  }

  private async issueTokens(user: User): Promise<AuthResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessExpiresIn = this.configService.getOrThrow<string>('jwt.expiresIn');
    const refreshExpiresIn = this.configService.getOrThrow<string>('jwt.refreshExpiresIn');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('jwt.secret'),
        expiresIn: accessExpiresIn as unknown as number,
      }),
      this.jwtService.signAsync(
        { sub: user.id, email: user.email, jti: randomUUID() },
        {
          secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
          expiresIn: refreshExpiresIn as unknown as number,
        },
      ),
    ]);

    // SHA-256 first to avoid bcrypt's 72-byte truncation on long JWT strings
    const tokenDigest = this.sha256(refreshToken);
    const refreshHash = await bcrypt.hash(tokenDigest, this.bcryptRounds);
    await this.usersService.updateRefreshTokenHash(user.id, refreshHash);

    return { accessToken, refreshToken };
  }

  private sha256(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }
}
