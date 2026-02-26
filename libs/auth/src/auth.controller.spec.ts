import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Role } from '@app/common';
import { User } from '@app/users';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Partial<AuthService>>;

  const mockTokens = { accessToken: 'access', refreshToken: 'refresh' };

  const mockUser: User = {
    id: 'user-uuid-1',
    email: 'test@test.com',
    passwordHash: 'hashed',
    role: Role.ADMIN,
    refreshTokenHash: null,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn().mockResolvedValue(mockTokens),
      login: jest.fn().mockResolvedValue(mockTokens),
      refresh: jest.fn().mockResolvedValue(mockTokens),
      logout: jest.fn().mockResolvedValue(undefined),
      getProfile: jest
        .fn()
        .mockResolvedValue({ id: 'user-uuid-1', email: 'test@test.com', role: Role.ADMIN }),
      forgotPassword: jest.fn().mockResolvedValue(undefined),
      resetPassword: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('register', () => {
    it('should call authService.register and return tokens', async () => {
      const dto = { email: 'test@test.com', password: 'StrongP@ss1', role: Role.ADMIN };
      const result = await controller.register(dto);
      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockTokens);
    });
  });

  describe('login', () => {
    it('should call authService.login with the user from passport', async () => {
      const dto = { email: 'test@test.com', password: 'StrongP@ss1' };
      const result = await controller.login(mockUser, dto);
      expect(authService.login).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mockTokens);
    });
  });

  describe('refresh', () => {
    it('should call authService.refresh with userId and refreshToken', async () => {
      const refreshUser = { id: 'user-uuid-1', email: 'test@test.com', refreshToken: 'old-token' };
      const dto = { refreshToken: 'old-token' };
      const result = await controller.refresh(refreshUser, dto);
      expect(authService.refresh).toHaveBeenCalledWith('user-uuid-1', 'old-token');
      expect(result).toEqual(mockTokens);
    });
  });

  describe('logout', () => {
    it('should call authService.logout and return message', async () => {
      const result = await controller.logout('user-uuid-1');
      expect(authService.logout).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('getProfile', () => {
    it('should call authService.getProfile and return profile', async () => {
      const result = await controller.getProfile('user-uuid-1');
      expect(authService.getProfile).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toHaveProperty('email', 'test@test.com');
    });
  });

  describe('forgotPassword', () => {
    it('should call authService.forgotPassword and return message', async () => {
      const result = await controller.forgotPassword({ email: 'test@test.com' });
      expect(authService.forgotPassword).toHaveBeenCalledWith('test@test.com');
      expect(result).toEqual({ message: 'If the email exists, a reset link will be sent' });
    });
  });

  describe('resetPassword', () => {
    it('should call authService.resetPassword and return message', async () => {
      const result = await controller.resetPassword({
        token: 'some-token',
        newPassword: 'NewStr0ngP@ss',
      });
      expect(authService.resetPassword).toHaveBeenCalledWith('some-token', 'NewStr0ngP@ss');
      expect(result).toEqual({ message: 'Password reset successfully' });
    });
  });
});
