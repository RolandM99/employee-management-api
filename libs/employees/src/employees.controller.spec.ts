import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

describe('EmployeesController', () => {
  let controller: EmployeesController;
  let employeesService: jest.Mocked<Partial<EmployeesService>>;

  beforeEach(async () => {
    employeesService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [{ provide: EmployeesService, useValue: employeesService }],
    }).compile();

    controller = module.get<EmployeesController>(EmployeesController);
  });

  it('creates employee through service', async () => {
    const dto = {
      names: 'John Doe',
      email: 'john@company.com',
      employeeIdentifier: 'EMP-1',
      phoneNumber: '+250788123456',
    };

    (employeesService.create as jest.Mock).mockResolvedValue({ id: 'employee-id', ...dto });

    const result = await controller.create(dto);

    expect(employeesService.create).toHaveBeenCalledWith(dto);
    expect(result).toHaveProperty('id', 'employee-id');
  });

  it('lists employees through service', async () => {
    const payload = {
      data: [],
      meta: { page: 1, limit: 20, total: 0 },
    };

    (employeesService.findAll as jest.Mock).mockResolvedValue(payload);

    const result = await controller.findAll({ page: 1, limit: 20 });

    expect(employeesService.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(result).toEqual(payload);
  });

  it('gets employee by id through service', async () => {
    const payload = { id: 'employee-id' };
    (employeesService.findById as jest.Mock).mockResolvedValue(payload);

    const result = await controller.findById('employee-id');

    expect(employeesService.findById).toHaveBeenCalledWith('employee-id');
    expect(result).toEqual(payload);
  });

  it('updates employee through service', async () => {
    const payload = { id: 'employee-id', names: 'Jane Doe' };
    (employeesService.update as jest.Mock).mockResolvedValue(payload);

    const result = await controller.update('employee-id', { names: 'Jane Doe' });

    expect(employeesService.update).toHaveBeenCalledWith('employee-id', { names: 'Jane Doe' });
    expect(result).toEqual(payload);
  });

  it('deletes employee through service', async () => {
    (employeesService.remove as jest.Mock).mockResolvedValue(undefined);

    const result = await controller.remove('employee-id');

    expect(employeesService.remove).toHaveBeenCalledWith('employee-id');
    expect(result).toEqual({ message: 'Employee deleted successfully' });
  });
});
