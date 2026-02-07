import { Module } from '@nestjs/common';
import { ConfigLibModule } from '@app/config';
import { DatabaseModule } from '@app/database';
import { AuthModule } from '@app/auth';
import { AttendanceModule } from '@app/attendance';
import { EmployeesModule } from '@app/employees';
import { ReportsModule } from '@app/reports';
import { HealthModule } from '@app/health';

@Module({
  imports: [
    ConfigLibModule,
    DatabaseModule,
    AuthModule,
    AttendanceModule,
    EmployeesModule,
    ReportsModule,
    HealthModule,
  ],
})
export class AppModule {}
