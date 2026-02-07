import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Employee } from './entities/employee.entity';
import {
  CreateEmployeeDto,
  ListEmployeesQueryDto,
  ListEmployeesResponseDto,
  UpdateEmployeeDto,
} from './dto';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
  ) {}

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    const employee = this.employeesRepository.create(dto);

    try {
      return await this.employeesRepository.save(employee);
    } catch (error: unknown) {
      this.handleUniqueConstraintError(error);
      throw error;
    }
  }

  async findAll(query: ListEmployeesQueryDto): Promise<ListEmployeesResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await this.employeesRepository.findAndCount({
      order: {
        createdAt: 'DESC',
      },
      skip,
      take: limit,
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async findById(id: string): Promise<Employee> {
    const employee = await this.employeesRepository.findOne({ where: { id } });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
    const employee = await this.findById(id);
    Object.assign(employee, dto);

    try {
      return await this.employeesRepository.save(employee);
    } catch (error: unknown) {
      this.handleUniqueConstraintError(error);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.employeesRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Employee not found');
    }
  }

  private handleUniqueConstraintError(error: unknown): void {
    if (!(error instanceof QueryFailedError)) {
      return;
    }

    const driverError = error.driverError as
      | {
          code?: string;
          errno?: number;
        }
      | undefined;

    if (driverError?.code === 'ER_DUP_ENTRY' || driverError?.errno === 1062) {
      throw new ConflictException('Employee email or identifier already exists');
    }
  }
}
