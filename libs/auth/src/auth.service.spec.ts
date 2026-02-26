import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { UsersService, User } from '@app/users';
import { Role } from '@app/common';
import { MailQueueService } from '@app/mail';

jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let jwtService: jest.Mocked<Partial<JwtService>>;
  let configService: jest.Mocked<Partial<ConfigService>>;
  let mailQueueService: jest.Mocked<Partial<MailQueueService>>;

  const mockUser: User = {
    id: 'user-uuid-1',
    email: 'test@test.com',
    passwordHash: '$2b$10$hashedpassword',
    role: Role.ADMIN,
    refreshTokenHash: null,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateRefreshTokenHash: jest.fn(),
      clearRefreshToken: jest.fn(),
      findByResetTokenHash: jest.fn(),
      updateResetToken: jest.fn(),
      updatePassword: jest.fn(),
    };

    jwtService = {
      signAsync: jest.fn(),
    };

    configService = {
      get: jest.fn(),
      getOrThrow: jest.fn(),
    };
    mailQueueService = {
      enqueueResetPasswordEmail: jest.fn(),
      enqueueAttendanceNotification: jest.fn(),
    };

    (configService.getOrThrow as jest.Mock).mockImplementation((key: string) => {
      const values: Record<string, string> = {
        'jwt.secret': 'test-secret',
        'jwt.expiresIn': '15m',
        'jwt.refreshSecret': 'test-refresh-secret',
        'jwt.refreshExpiresIn': '7d',
        'frontend.resetUrl': 'http://localhost:3001/reset-password',
      };
      return values[key];
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: MailQueueService, useValue: mailQueueService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should hash password and create user then return tokens', async () => {
      (mockedBcrypt.hash as jest.Mock)
        .mockResolvedValueOnce('hashed_password' as never)
        .mockResolvedValueOnce('hashed_refresh' as never);
      (usersService.create as jest.Mock).mockResolvedValue(mockUser);
      (jwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.register({
        email: 'test@test.com',
        password: 'StrongP@ss1',
        role: Role.ADMIN,
      });

      expect(usersService.create).toHaveBeenCalledWith({
        email: 'test@test.com',
        passwordHash: 'hashed_password',
        role: Role.ADMIN,
      });
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(usersService.updateRefreshTokenHash).toHaveBeenCalledWith(
        mockUser.id,
        'hashed_refresh',
      );
    });

    it('should propagate ConflictException from UsersService', async () => {
      (mockedBcrypt.hash as jest.Mock).mockResolvedValueOnce('hashed' as never);
      (usersService.create as jest.Mock).mockRejectedValue(
        new ConflictException('Email already registered'),
      );

      await expect(
        service.register({ email: 'dup@test.com', password: 'StrongP@ss1' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true as never);

      const result = await service.validateUser('test@test.com', 'StrongP@ss1');
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);

      const result = await service.validateUser('no@test.com', 'pass');
      expect(result).toBeNull();
    });

    it('should return null when password does not match', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false as never);

      const result = await service.validateUser('test@test.com', 'wrong');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access and refresh tokens', async () => {
      (jwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      (mockedBcrypt.hash as jest.Mock).mockResolvedValueOnce('hashed_refresh' as never);

      const result = await service.login(mockUser);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });
  });

  describe('refresh', () => {
    it('should issue new tokens when refresh token hash matches', async () => {
      const userWithHash = { ...mockUser, refreshTokenHash: 'stored_hash' };
      (usersService.findById as jest.Mock).mockResolvedValue(userWithHash);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true as never);
      (jwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce('new-access')
        .mockResolvedValueOnce('new-refresh');
      (mockedBcrypt.hash as jest.Mock).mockResolvedValueOnce('new_hashed_refresh' as never);

      const result = await service.refresh('user-uuid-1', 'old-refresh-token');
      expect(result.accessToken).toBe('new-access');
      expect(result.refreshToken).toBe('new-refresh');
    });

    it('should throw UnauthorizedException when user not found', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.refresh('bad-id', 'token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when no stored refresh hash', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.refresh('user-uuid-1', 'token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException when hash does not match', async () => {
      const userWithHash = { ...mockUser, refreshTokenHash: 'stored_hash' };
      (usersService.findById as jest.Mock).mockResolvedValue(userWithHash);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false as never);

      await expect(service.refresh('user-uuid-1', 'wrong-token')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('logout', () => {
    it('should clear refresh token for user', async () => {
      await service.logout('user-uuid-1');
      expect(usersService.clearRefreshToken).toHaveBeenCalledWith('user-uuid-1');
    });
  });

  describe('getProfile', () => {
    it('should return user without sensitive fields', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.getProfile('user-uuid-1');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('refreshTokenHash');
      expect(result).not.toHaveProperty('resetTokenHash');
      expect(result).not.toHaveProperty('resetTokenExpiresAt');
      expect(result).toHaveProperty('email', 'test@test.com');
    });

    it('should throw UnauthorizedException when user not found', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.getProfile('bad-id')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('should generate a reset token and store its hash', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);

      await service.forgotPassword('test@test.com');

      expect(usersService.findByEmail).toHaveBeenCalledWith('test@test.com');
      expect(usersService.updateResetToken).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(String),
        expect.any(Date),
      );
      expect(mailQueueService.enqueueResetPasswordEmail).toHaveBeenCalledWith({
        email: mockUser.email,
        resetUrl: expect.stringContaining('http://localhost:3001/reset-password?token='),
      });
    });

    it('should not throw when email does not exist (prevent enumeration)', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);

      await expect(service.forgotPassword('nobody@test.com')).resolves.toBeUndefined();
      expect(usersService.updateResetToken).not.toHaveBeenCalled();
      expect(mailQueueService.enqueueResetPasswordEmail).not.toHaveBeenCalled();
    });

    it('should store a SHA-256 hash, not the raw token', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);

      await service.forgotPassword('test@test.com');

      const storedHash = (usersService.updateResetToken as jest.Mock).mock.calls[0][1];
      // SHA-256 hex is 64 characters
      expect(storedHash).toHaveLength(64);
      expect(storedHash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('resetPassword', () => {
    const rawToken = 'a'.repeat(64);
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    it('should reset password and clear reset token + refresh token', async () => {
      const userWithResetToken = {
        ...mockUser,
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
      };
      (usersService.findByResetTokenHash as jest.Mock).mockResolvedValue(userWithResetToken);
      (mockedBcrypt.hash as jest.Mock).mockResolvedValueOnce('new_hashed_password' as never);

      await service.resetPassword(rawToken, 'NewStr0ngP@ss');

      expect(usersService.findByResetTokenHash).toHaveBeenCalledWith(tokenHash);
      expect(usersService.updatePassword).toHaveBeenCalledWith(mockUser.id, 'new_hashed_password');
      expect(usersService.updateResetToken).toHaveBeenCalledWith(mockUser.id, null, null);
      expect(usersService.clearRefreshToken).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw BadRequestException for invalid token', async () => {
      (usersService.findByResetTokenHash as jest.Mock).mockResolvedValue(null);

      await expect(service.resetPassword('bad-token', 'NewStr0ngP@ss')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for expired token', async () => {
      const userWithExpiredToken = {
        ...mockUser,
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: new Date(Date.now() - 60 * 1000), // 1 min ago
      };
      (usersService.findByResetTokenHash as jest.Mock).mockResolvedValue(userWithExpiredToken);

      await expect(service.resetPassword(rawToken, 'NewStr0ngP@ss')).rejects.toThrow(
        BadRequestException,
      );
      // Should clear the expired token
      expect(usersService.updateResetToken).toHaveBeenCalledWith(mockUser.id, null, null);
    });
  });
});
