import './common/utils/env';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadConfig } from './config/configuration';
import { requestContextMiddleware } from './common/request/request-context';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bufferLogs: false,
  });

  app.use(requestContextMiddleware);
  app.use(helmet());
  app.use(cookieParser());

  app.setGlobalPrefix(config.apiPrefix);
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Company-Id', 'X-Request-Id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableShutdownHooks();

  if (config.env !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Startup Starter API')
      .setDescription(
        'Multi-tenant recruitment SaaS backend. All endpoints (except @Public) require a Bearer access token. ' +
          'Company-scoped endpoints derive the tenant from the authenticated membership (route param :companyId, ' +
          'X-Company-Id header, or a single active membership) — never from request bodies.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('refresh_token')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(config.port, process.env.HOST ?? '0.0.0.0');
  Logger.log(`Startup Starter API listening on http://localhost:${config.port}/${config.apiPrefix}`, 'Bootstrap');
  if (config.env !== 'production') {
    Logger.log(`Swagger available at http://localhost:${config.port}/docs`, 'Bootstrap');
  }
}

void bootstrap();
