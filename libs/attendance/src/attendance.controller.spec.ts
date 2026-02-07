import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

describe('AttendanceController', () => {
  let controller: AttendanceController;
  let attendanceService: jest.Mocked<Partial<AttendanceService>>;

  beforeEach(async () => {
    attendanceService = {
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [{ provide: AttendanceService, useValue: attendanceService }],
    }).compile();

    controller = module.get<AttendanceController>(AttendanceController);
  });

  it('calls service.checkIn', async () => {
    const response = {
      id: 'attendance-id',
      employeeId: '2f56f85a-f8e4-4c03-82a2-b723bcf6e1f4',
      date: '2026-02-07',
      checkInAt: new Date('2026-02-07T09:00:00.000Z'),
      checkOutAt: null,
      createdAt: new Date('2026-02-07T09:00:00.000Z'),
      updatedAt: new Date('2026-02-07T09:00:00.000Z'),
    };

    (attendanceService.checkIn as jest.Mock).mockResolvedValue(response);

    const dto = {
      employeeId: '2f56f85a-f8e4-4c03-82a2-b723bcf6e1f4',
      occurredAt: '2026-02-07T09:00:00',
    };

    const result = await controller.checkIn(dto);

    expect(attendanceService.checkIn).toHaveBeenCalledWith(dto);
    expect(result).toEqual(response);
  });

  it('calls service.checkOut', async () => {
    const response = {
      id: 'attendance-id',
      employeeId: '2f56f85a-f8e4-4c03-82a2-b723bcf6e1f4',
      date: '2026-02-07',
      checkInAt: new Date('2026-02-07T09:00:00.000Z'),
      checkOutAt: new Date('2026-02-07T17:00:00.000Z'),
      createdAt: new Date('2026-02-07T09:00:00.000Z'),
      updatedAt: new Date('2026-02-07T17:00:00.000Z'),
    };

    (attendanceService.checkOut as jest.Mock).mockResolvedValue(response);

    const dto = {
      employeeId: '2f56f85a-f8e4-4c03-82a2-b723bcf6e1f4',
      occurredAt: '2026-02-07T17:00:00',
    };

    const result = await controller.checkOut(dto);

    expect(attendanceService.checkOut).toHaveBeenCalledWith(dto);
    expect(result).toEqual(response);
  });

  it('calls service.findAll', async () => {
    const response = [
      {
        id: 'attendance-id',
        employeeId: '2f56f85a-f8e4-4c03-82a2-b723bcf6e1f4',
        date: '2026-02-07',
        checkInAt: new Date('2026-02-07T09:00:00.000Z'),
        checkOutAt: null,
        createdAt: new Date('2026-02-07T09:00:00.000Z'),
        updatedAt: new Date('2026-02-07T09:00:00.000Z'),
      },
    ];

    (attendanceService.findAll as jest.Mock).mockResolvedValue(response);

    const query = {
      employeeId: '2f56f85a-f8e4-4c03-82a2-b723bcf6e1f4',
      dateFrom: '2026-02-01',
      dateTo: '2026-02-28',
    };

    const result = await controller.findAll(query);

    expect(attendanceService.findAll).toHaveBeenCalledWith(query);
    expect(result).toEqual(response);
  });
});
