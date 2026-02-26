import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { Employee } from './entities/employee.entity';
import { EmployeesService } from './employees.service';

type EmployeeRepositoryMock = {
  create: jest.Mock;
  save: jest.Mock;
  findAndCount: jest.Mock;
  findOne: jest.Mock;
  delete: jest.Mock;
  createQueryBuilder: jest.Mock;
};

describe('EmployeesService', () => {
  let service: EmployeesService;
  let repository: EmployeeRepositoryMock;

  const employee: Employee = {
    id: 'employee-id',
    names: 'John Doe',
    email: 'john@company.com',
    employeeIdentifier: 'EMP-1',
    phoneNumber: '+250788123456',
    createdAt: new Date('2026-02-07T09:00:00.000Z'),
    updatedAt: new Date('2026-02-07T09:00:00.000Z'),
    attendances: [],
  };

  beforeEach(async () => {
    const qbMock = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        {
          provide: getRepositoryToken(Employee),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  it('creates employee', async () => {
    repository.create.mockReturnValue(employee);
    repository.save.mockResolvedValue(employee);

    const result = await service.create({
      names: employee.names,
      email: employee.email,
      employeeIdentifier: employee.employeeIdentifier,
      phoneNumber: employee.phoneNumber,
    });

    expect(result).toEqual(employee);
  });

  it('throws conflict for duplicate create', async () => {
    repository.create.mockReturnValue(employee);
    repository.save.mockRejectedValue(
      new QueryFailedError('insert ...', [], {
        code: 'ER_DUP_ENTRY',
        errno: 1062,
      } as Error & { code: string; errno: number }),
    );

    await expect(
      service.create({
        names: employee.names,
        email: employee.email,
        employeeIdentifier: employee.employeeIdentifier,
        phoneNumber: employee.phoneNumber,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('lists employees with default pagination', async () => {
    repository.findAndCount.mockResolvedValue([[employee], 1]);

    const result = await service.findAll({});

    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
    expect(result.meta.total).toBe(1);
  });

  it('finds employee by id', async () => {
    repository.findOne.mockResolvedValue(employee);

    const result = await service.findById('employee-id');

    expect(result).toEqual(employee);
  });

  it('throws not found when employee does not exist', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
  });

  it('updates employee', async () => {
    repository.findOne.mockResolvedValue(employee);
    repository.save.mockResolvedValue({ ...employee, names: 'Updated Name' });

    const result = await service.update('employee-id', { names: 'Updated Name' });

    expect(result.names).toBe('Updated Name');
  });

  it('throws conflict on duplicate update', async () => {
    repository.findOne.mockResolvedValue(employee);
    repository.save.mockRejectedValue(
      new QueryFailedError('update ...', [], {
        code: 'ER_DUP_ENTRY',
        errno: 1062,
      } as Error & { code: string; errno: number }),
    );

    await expect(service.update('employee-id', { email: 'dup@company.com' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('removes employee', async () => {
    repository.delete.mockResolvedValue({ affected: 1, raw: {} });

    await expect(service.remove('employee-id')).resolves.toBeUndefined();
  });

  it('throws not found on delete missing employee', async () => {
    repository.delete.mockResolvedValue({ affected: 0, raw: {} });

    await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
  });

  describe('findAllWithAttendanceCount', () => {
    it('returns employees with attendance counts', async () => {
      const qb = repository.createQueryBuilder();
      qb.getRawMany.mockResolvedValue([
        { id: 'emp-1', names: 'John Doe', attendancesCount: '5' },
        { id: 'emp-2', names: 'Jane Doe', attendancesCount: '0' },
      ]);

      const result = await service.findAllWithAttendanceCount();

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('employee');
      expect(qb.leftJoin).toHaveBeenCalledWith('employee.attendances', 'attendance');
      expect(qb.groupBy).toHaveBeenCalledWith('employee.id');
      expect(result).toEqual([
        { id: 'emp-1', names: 'John Doe', attendancesCount: 5 },
        { id: 'emp-2', names: 'Jane Doe', attendancesCount: 0 },
      ]);
    });

    it('returns empty array when no employees exist', async () => {
      const qb = repository.createQueryBuilder();
      qb.getRawMany.mockResolvedValue([]);

      const result = await service.findAllWithAttendanceCount();

      expect(result).toEqual([]);
    });

    it('casts attendancesCount from string to number', async () => {
      const qb = repository.createQueryBuilder();
      qb.getRawMany.mockResolvedValue([
        { id: 'emp-1', names: 'John Doe', attendancesCount: '12' },
      ]);

      const result = await service.findAllWithAttendanceCount();

      expect(typeof result[0].attendancesCount).toBe('number');
      expect(result[0].attendancesCount).toBe(12);
    });
  });
});
