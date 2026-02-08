import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { AttendanceResponseDto } from './dto/attendance-response.dto';
import { ListAttendanceQueryDto } from './dto/list-attendance-query.dto';

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @ApiOperation({ summary: 'Check in employee for the current day' })
  @ApiResponse({ status: 201, type: AttendanceResponseDto })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({ status: 409, description: 'Employee already checked in for this date' })
  async checkIn(@Body() dto: CheckInDto): Promise<AttendanceResponseDto> {
    return this.attendanceService.checkIn(dto);
  }

  @Post('check-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check out employee for the current day' })
  @ApiResponse({ status: 200, type: AttendanceResponseDto })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot check out before check-in or already checked out',
  })
  async checkOut(@Body() dto: CheckOutDto): Promise<AttendanceResponseDto> {
    return this.attendanceService.checkOut(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List attendance records with optional filters' })
  @ApiResponse({ status: 200, type: [AttendanceResponseDto] })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  async findAll(@Query() query: ListAttendanceQueryDto): Promise<AttendanceResponseDto[]> {
    return this.attendanceService.findAll(query);
  }
}
