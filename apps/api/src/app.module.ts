import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { AdminGuard } from './auth/admin.guard';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { AppConfig } from './config/app-config';
import { validateEnv } from './config/env';
import { ENV_FILES } from './config/paths';
import { DbService } from './db/db.service';
import { AdminUploadsController, FilesController } from './files/files.controller';
import { FilesService } from './files/files.service';
import { FormsController } from './forms/forms.controller';
import { FormsService } from './forms/forms.service';
import { HealthController } from './health/health.controller';
import { PublicController } from './public/public.controller';
import { PublicService } from './public/public.service';
import { RateLimitGuard } from './redis/rate-limit';
import { RedisService } from './redis/redis.service';
import { ResponsesController } from './responses/responses.controller';
import { ResponsesService } from './responses/responses.service';
import { StorageService } from './storage/storage.service';
import { WebhooksController } from './webhooks/webhooks.controller';
import { WebhooksService } from './webhooks/webhooks.service';

/** Infrastructure shared by every feature: config, postgres, redis, s3. */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ENV_FILES,
      validate: validateEnv,
    }),
  ],
  providers: [AppConfig, DbService, RedisService, StorageService],
  exports: [AppConfig, DbService, RedisService, StorageService],
})
export class CoreModule {}

@Module({
  imports: [CoreModule],
  controllers: [
    HealthController,
    AuthController,
    FormsController,
    ResponsesController,
    AnalyticsController,
    AdminUploadsController,
    FilesController,
    PublicController,
    WebhooksController,
  ],
  providers: [
    AuthService,
    AdminGuard,
    FormsService,
    ResponsesService,
    AnalyticsService,
    FilesService,
    PublicService,
    WebhooksService,
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
