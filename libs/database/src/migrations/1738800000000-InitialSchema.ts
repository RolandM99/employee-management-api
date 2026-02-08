import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1738800000000 implements MigrationInterface {
  name = 'InitialSchema1738800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Users table
    await queryRunner.query(`
      CREATE TABLE \`users\` (
        \`id\` varchar(36) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`passwordHash\` varchar(255) NOT NULL,
        \`role\` enum('admin', 'manager', 'employee') NULL DEFAULT NULL,
        \`refreshTokenHash\` varchar(255) NULL DEFAULT NULL,
        \`resetTokenHash\` varchar(255) NULL DEFAULT NULL,
        \`resetTokenExpiresAt\` timestamp NULL DEFAULT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_users_email\` (\`email\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    // Employees table
    await queryRunner.query(`
      CREATE TABLE \`employees\` (
        \`id\` varchar(36) NOT NULL,
        \`names\` varchar(255) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`employeeIdentifier\` varchar(100) NOT NULL,
        \`phoneNumber\` varchar(50) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_employees_email\` (\`email\`),
        UNIQUE INDEX \`IDX_employees_employeeIdentifier\` (\`employeeIdentifier\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    // Attendances table
    await queryRunner.query(`
      CREATE TABLE \`attendances\` (
        \`id\` varchar(36) NOT NULL,
        \`employeeId\` varchar(36) NOT NULL,
        \`date\` date NOT NULL,
        \`checkInAt\` datetime NOT NULL,
        \`checkOutAt\` datetime NULL DEFAULT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX \`IDX_attendances_employeeId\` (\`employeeId\`),
        UNIQUE INDEX \`UQ_attendance_employee_date\` (\`employeeId\`, \`date\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    // Foreign key: attendances.employeeId -> employees.id
    await queryRunner.query(`
      ALTER TABLE \`attendances\`
        ADD CONSTRAINT \`FK_attendances_employeeId\`
        FOREIGN KEY (\`employeeId\`) REFERENCES \`employees\`(\`id\`)
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`attendances\` DROP FOREIGN KEY \`FK_attendances_employeeId\``,
    );
    await queryRunner.query(`DROP TABLE \`attendances\``);
    await queryRunner.query(`DROP TABLE \`employees\``);
    await queryRunner.query(`DROP TABLE \`users\``);
  }
}
