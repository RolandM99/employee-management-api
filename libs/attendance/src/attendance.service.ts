import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';
import { MailQueueService } from '@app/mail';
import { Employee } from '@app/employees';
import { Attendance } from './entities/attendance.entity';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { ListAttendanceQueryDto } from './dto/list-attendance-query.dto';

type AttendanceEventType = 'check-in' | 'check-out';

interface AttendanceTransactionResult {
  attendance: Attendance;
  employee: Employee;
  eventType: AttendanceEventType;
  occurredAt: Date;
  date: string;
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly mailQueueService: MailQueueService,
  ) {}

  async checkIn(dto: CheckInDto): Promise<Attendance> {
    const occurredAt = this.resolveOccurredAt(dto.occurredAt);
    const date = this.toDateOnly(occurredAt);

    let result: AttendanceTransactionResult;
    try {
      result = await this.dataSource.transaction(async (manager) => {
        const employee = await this.getEmployeeOrFail(manager, dto.employeeId);
        const attendanceRepository = manager.getRepository(Attendance);

        const existingAttendance = await this.findAttendanceForUpdate(
          attendanceRepository,
          dto.employeeId,
          date,
        );

        if (existingAttendance) {
          throw new ConflictException('Employee already checked in for this date');
        }

        const createdAttendance = attendanceRepository.create({
          employeeId: dto.employeeId,
          date,
          checkInAt: occurredAt,
          checkOutAt: null,
        });

        const savedAttendance = await attendanceRepository.save(createdAttendance);
        return {
          attendance: savedAttendance,
          employee,
          eventType: 'check-in',
          occurredAt,
          date,
        };
      });
    } catch (error: unknown) {
      if (this.isDuplicateAttendanceError(error)) {
        throw new ConflictException('Employee already checked in for this date');
      }
      throw error;
    }

    await this.enqueueAttendanceNotification(result);
    return result.attendance;
  }

  async checkOut(dto: CheckOutDto): Promise<Attendance> {
    const occurredAt = this.resolveOccurredAt(dto.occurredAt);
    const date = this.toDateOnly(occurredAt);

    const result = await this.dataSource.transaction(async (manager) => {
      const employee = await this.getEmployeeOrFail(manager, dto.employeeId);
      const attendanceRepository = manager.getRepository(Attendance);

      const existingAttendance = await this.findAttendanceForUpdate(
        attendanceRepository,
        dto.employeeId,
        date,
      );

      if (!existingAttendance) {
        throw new ConflictException('Cannot check out before check-in for this date');
      }

      if (existingAttendance.checkOutAt) {
        throw new ConflictException('Employee already checked out for this date');
      }

      existingAttendance.checkOutAt = occurredAt;
      const savedAttendance = await attendanceRepository.save(existingAttendance);

      return {
        attendance: savedAttendance,
        employee,
        eventType: 'check-out' as const,
        occurredAt,
        date,
      };
    });

    await this.enqueueAttendanceNotification(result);
    return result.attendance;
  }

  async findAll(query: ListAttendanceQueryDto): Promise<Attendance[]> {
    const dateFrom = query.dateFrom ? this.toDateOnly(new Date(query.dateFrom)) : undefined;
    const dateTo = query.dateTo ? this.toDateOnly(new Date(query.dateTo)) : undefined;

    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new BadRequestException('dateFrom cannot be greater than dateTo');
    }

    const attendanceRepository = this.dataSource.getRepository(Attendance);
    const queryBuilder = attendanceRepository
      .createQueryBuilder('attendance')
      .orderBy('attendance.date', 'DESC')
      .addOrderBy('attendance.createdAt', 'DESC');

    if (query.employeeId) {
      queryBuilder.andWhere('attendance.employeeId = :employeeId', {
        employeeId: query.employeeId,
      });
    }

    if (dateFrom) {
      queryBuilder.andWhere('attendance.date >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      queryBuilder.andWhere('attendance.date <= :dateTo', { dateTo });
    }

    return queryBuilder.getMany();
  }

  private async enqueueAttendanceNotification(result: AttendanceTransactionResult): Promise<void> {
    await this.mailQueueService.enqueueAttendanceNotification({
      email: result.employee.email,
      employeeName: result.employee.names,
      attendanceDate: result.date,
      status: result.eventType,
      occurredAt: result.occurredAt.toISOString(),
    });

    this.logger.log(
      `Queued attendance ${result.eventType} notification for employeeId=${result.employee.id} on ${result.date}`,
    );
  }

  private async getEmployeeOrFail(manager: EntityManager, employeeId: string): Promise<Employee> {
    const employeeRepository = manager.getRepository(Employee);

    const employee = await employeeRepository
      .createQueryBuilder('employee')
      .setLock('pessimistic_write')
      .where('employee.id = :employeeId', { employeeId })
      .getOne();

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }

  private async findAttendanceForUpdate(
    attendanceRepository: Repository<Attendance>,
    employeeId: string,
    date: string,
  ): Promise<Attendance | null> {
    return attendanceRepository
      .createQueryBuilder('attendance')
      .setLock('pessimistic_write')
      .where('attendance.employeeId = :employeeId', { employeeId })
      .andWhere('attendance.date = :date', { date })
      .getOne();
  }

  private resolveOccurredAt(value?: string): Date {
    if (!value) {
      return new Date();
    }

    return new Date(value);
  }

  private toDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private isDuplicateAttendanceError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as { code?: string; errno?: number } | undefined;
    return driverError?.code === 'ER_DUP_ENTRY' || driverError?.errno === 1062;
  }
}
