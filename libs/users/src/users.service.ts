import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from '@app/common';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(data: { email: string; passwordHash: string; role?: Role }): Promise<User> {
    const existing = await this.findByEmail(data.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  async updateRefreshTokenHash(userId: string, hash: string): Promise<void> {
    const result = await this.usersRepository.update(userId, {
      refreshTokenHash: hash,
    });
    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }
  }

  async clearRefreshToken(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      refreshTokenHash: null,
    });
  }

  async findByResetTokenHash(hash: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { resetTokenHash: hash } });
  }

  async updateResetToken(
    userId: string,
    hash: string | null,
    expiresAt: Date | null,
  ): Promise<void> {
    await this.usersRepository.update(userId, {
      resetTokenHash: hash,
      resetTokenExpiresAt: expiresAt,
    });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.usersRepository.update(userId, { passwordHash });
  }
}
