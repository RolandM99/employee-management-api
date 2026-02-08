import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { MailQueueService } from '@app/mail';
import { Employee } from '@app/employees';
import { Attendance } from './entities/attendance.entity';
import { AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let dataSource: jest.Mocked<Partial<DataSource>>;
  let mailQueueService: jest.Mocked<Partial<MailQueueService>>;

  const employee: Employee = {
    id: '2f56f85a-f8e4-4c03-82a2-b723bcf6e1f4',
    names: 'John Doe',
    email: 'john.doe@company.com',
    employeeIdentifier: 'EMP001',
    phoneNumber: '+250788123456',
    createdAt: new Date('2026-02-07T08:00:00'),
    updatedAt: new Date('2026-02-07T08:00:00'),
    attendances: [],
  };

  const makeTransactionContext = () => {
    const employeeQueryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    const attendanceQueryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    const employeeRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(employeeQueryBuilder),
    };

    const attendanceRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(attendanceQueryBuilder),
      create: jest.fn(),
      save: jest.fn(),
    };

    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Employee) {
          return employeeRepository;
        }

        if (entity === Attendance) {
          return attendanceRepository;
        }

        throw new Error('Unexpected repository requested');
      }),
    };

    return {
      employeeQueryBuilder,
      attendanceQueryBuilder,
      attendanceRepository,
      manager,
    };
  };

  beforeEach(async () => {
    dataSource = {
      transaction: jest.fn(),
      getRepository: jest.fn(),
    };

    mailQueueService = {
      enqueueAttendanceNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: DataSource, useValue: dataSource },
        { provide: MailQueueService, useValue: mailQueueService },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  it('checks in employee and enqueues attendance notification', async () => {
    const context = makeTransactionContext();
    const dto: CheckInDto = {
      employeeId: employee.id,
      occurredAt: '2026-02-07T09:00:00',
    };

    const savedAttendance: Attendance = {
      id: 'f6493326-f6b9-4da8-8f90-dd1c0f2171a9',
      employeeId: employee.id,
      date: '2026-02-07',
      checkInAt: new Date('2026-02-07T09:00:00'),
      checkOutAt: null,
      createdAt: new Date('2026-02-07T09:00:00'),
      updatedAt: new Date('2026-02-07T09:00:00'),
      employee,
    };

    context.employeeQueryBuilder.getOne.mockResolvedValue(employee);
    context.attendanceQueryBuilder.getOne.mockResolvedValue(null);
    context.attendanceRepository.create.mockReturnValue(savedAttendance);
    context.attendanceRepository.save.mockResolvedValue(savedAttendance);

    (dataSource.transaction as jest.Mock).mockImplementation(
      async (runInTransaction: (manager: unknown) => Promise<unknown>) =>
        runInTransaction(context.manager),
    );

    const result = await service.checkIn(dto);

    expect(result).toEqual(savedAttendance);
    expect(mailQueueService.enqueueAttendanceNotification).toHaveBeenCalledWith({
      email: employee.email,
      employeeName: employee.names,
      attendanceDate: '2026-02-07',
      status: 'check-in',
      occurredAt: new Date('2026-02-07T09:00:00').toISOString(),
    });
  });

  it('throws ConflictException when checking in twice on same day', async () => {
    const context = makeTransactionContext();
    const dto: CheckInDto = {
      employeeId: employee.id,
      occurredAt: '2026-02-07T09:00:00',
    };

    context.employeeQueryBuilder.getOne.mockResolvedValue(employee);
    context.attendanceQueryBuilder.getOne.mockResolvedValue({
      id: 'existing-attendance',
      employeeId: employee.id,
      date: '2026-02-07',
      checkInAt: new Date('2026-02-07T09:00:00'),
      checkOutAt: null,
    });

    (dataSource.transaction as jest.Mock).mockImplementation(
      async (runInTransaction: (manager: unknown) => Promise<unknown>) =>
        runInTransaction(context.manager),
    );

    await expect(service.checkIn(dto)).rejects.toThrow(ConflictException);
    expect(mailQueueService.enqueueAttendanceNotification).not.toHaveBeenCalled();
  });

  it('maps duplicate-key race condition to ConflictException on check-in', async () => {
    const context = makeTransactionContext();
    const dto: CheckInDto = {
      employeeId: employee.id,
      occurredAt: '2026-02-07T09:00:00',
    };

    const createdAttendance = {
      employeeId: employee.id,
      date: '2026-02-07',
      checkInAt: new Date('2026-02-07T09:00:00'),
      checkOutAt: null,
    } as Attendance;

    context.employeeQueryBuilder.getOne.mockResolvedValue(employee);
    context.attendanceQueryBuilder.getOne.mockResolvedValue(null);
    context.attendanceRepository.create.mockReturnValue(createdAttendance);
    context.attendanceRepository.save.mockRejectedValue(
      new QueryFailedError('INSERT INTO attendances ...', [], {
        code: 'ER_DUP_ENTRY',
        errno: 1062,
      } as Error & { code: string; errno: number }),
    );

    (dataSource.transaction as jest.Mock).mockImplementation(
      async (runInTransaction: (manager: unknown) => Promise<unknown>) =>
        runInTransaction(context.manager),
    );

    await expect(service.checkIn(dto)).rejects.toThrow(ConflictException);
    expect(mailQueueService.enqueueAttendanceNotification).not.toHaveBeenCalled();
  });

  it('checks out employee and enqueues attendance notification', async () => {
    const context = makeTransactionContext();
    const dto: CheckOutDto = {
      employeeId: employee.id,
      occurredAt: '2026-02-07T17:00:00',
    };

    const existingAttendance: Attendance = {
      id: 'attendance-id',
      employeeId: employee.id,
      date: '2026-02-07',
      checkInAt: new Date('2026-02-07T09:00:00'),
      checkOutAt: null,
      createdAt: new Date('2026-02-07T09:00:00'),
      updatedAt: new Date('2026-02-07T09:00:00'),
      employee,
    };

    const savedAttendance: Attendance = {
      ...existingAttendance,
      checkOutAt: new Date('2026-02-07T17:00:00'),
      updatedAt: new Date('2026-02-07T17:00:00'),
    };

    context.employeeQueryBuilder.getOne.mockResolvedValue(employee);
    context.attendanceQueryBuilder.getOne.mockResolvedValue(existingAttendance);
    context.attendanceRepository.save.mockResolvedValue(savedAttendance);

    (dataSource.transaction as jest.Mock).mockImplementation(
      async (runInTransaction: (manager: unknown) => Promise<unknown>) =>
        runInTransaction(context.manager),
    );

    const result = await service.checkOut(dto);

    expect(result).toEqual(savedAttendance);
    expect(mailQueueService.enqueueAttendanceNotification).toHaveBeenCalledWith({
      email: employee.email,
      employeeName: employee.names,
      attendanceDate: '2026-02-07',
      status: 'check-out',
      occurredAt: new Date('2026-02-07T17:00:00').toISOString(),
    });
  });

  it('throws NotFoundException when employee does not exist', async () => {
    const context = makeTransactionContext();

    context.employeeQueryBuilder.getOne.mockResolvedValue(null);

    (dataSource.transaction as jest.Mock).mockImplementation(
      async (runInTransaction: (manager: unknown) => Promise<unknown>) =>
        runInTransaction(context.manager),
    );

    await expect(
      service.checkOut({ employeeId: employee.id, occurredAt: '2026-02-07T17:00:00' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when check-out is attempted before check-in', async () => {
    const context = makeTransactionContext();

    context.employeeQueryBuilder.getOne.mockResolvedValue(employee);
    context.attendanceQueryBuilder.getOne.mockResolvedValue(null);

    (dataSource.transaction as jest.Mock).mockImplementation(
      async (runInTransaction: (manager: unknown) => Promise<unknown>) =>
        runInTransaction(context.manager),
    );

    await expect(
      service.checkOut({ employeeId: employee.id, occurredAt: '2026-02-07T17:00:00' }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException when employee already checked out', async () => {
    const context = makeTransactionContext();

    context.employeeQueryBuilder.getOne.mockResolvedValue(employee);
    context.attendanceQueryBuilder.getOne.mockResolvedValue({
      id: 'attendance-id',
      employeeId: employee.id,
      date: '2026-02-07',
      checkInAt: new Date('2026-02-07T09:00:00'),
      checkOutAt: new Date('2026-02-07T17:00:00'),
    });

    (dataSource.transaction as jest.Mock).mockImplementation(
      async (runInTransaction: (manager: unknown) => Promise<unknown>) =>
        runInTransaction(context.manager),
    );

    await expect(
      service.checkOut({ employeeId: employee.id, occurredAt: '2026-02-07T17:30:00' }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws BadRequestException when dateFrom is greater than dateTo', async () => {
    await expect(
      service.findAll({
        dateFrom: '2026-02-08',
        dateTo: '2026-02-07',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
