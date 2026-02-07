import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, RequestMethod, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter, ResponseEnvelopeInterceptor } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Global prefix + health endpoint exclusion
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  // URI versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // CORS
  app.enableCors();

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Employee Management API')
    .setDescription(
      'NestJS v11 Employee Management + Attendance API. Versioned routes are under /api/v1.',
    )
    .setVersion('1.0')
    .addServer('/api/v1', 'Version 1')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'JWT access token',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Employee Management API Docs',
    jsonDocumentUrl: 'docs/json',
  });

  const port = process.env.APP_PORT ?? 3000;
  await app.listen(port);
  logger.log(`Application running on http://localhost:${port}`);
  logger.log(`API base URL: http://localhost:${port}/api/v1`);
  logger.log(`Swagger docs at http://localhost:${port}/docs`);
}

bootstrap();
