import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import {
  CreateEmployeeDto,
  EmployeeResponseDto,
  ListEmployeesQueryDto,
  ListEmployeesResponseDto,
  UpdateEmployeeDto,
} from './dto';

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @ApiOperation({ summary: 'Create employee' })
  @ApiResponse({ status: 201, type: EmployeeResponseDto })
  @ApiResponse({ status: 409, description: 'Employee email or identifier already exists' })
  async create(@Body() dto: CreateEmployeeDto): Promise<EmployeeResponseDto> {
    return this.employeesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List employees' })
  @ApiResponse({ status: 200, type: ListEmployeesResponseDto })
  async findAll(@Query() query: ListEmployeesQueryDto): Promise<ListEmployeesResponseDto> {
    return this.employeesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get employee by id' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, type: EmployeeResponseDto })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async findById(@Param('id') id: string): Promise<EmployeeResponseDto> {
    return this.employeesService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update employee by id' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, type: EmployeeResponseDto })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({ status: 409, description: 'Employee email or identifier already exists' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete employee by id' })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Employee deleted successfully' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.employeesService.remove(id);
    return { message: 'Employee deleted successfully' };
  }
}
