import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { preloadGeoip } from './common/client-info';
import { AppConfig } from './config/app-config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const logger = new Logger('Bootstrap');
  const config = app.get(AppConfig);

  app.set('trust proxy', config.env.TRUST_PROXY);
  app.disable('x-powered-by');
  app.setGlobalPrefix('api');

  app.use(
    helmet({
      // files under /api/files are embedded by the web app (and possibly other origins)
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    compression({
      filter: (req, res) => !req.url.startsWith('/api/files/') && compression.filter(req, res),
    }),
  );
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '5mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });
  // navigator.sendBeacon() posts text/plain
  app.useBodyParser('text', { limit: '64kb', type: 'text/plain' });

  app.enableCors({
    origin: config.webOrigins.length ? config.webOrigins : false,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['Content-Disposition', 'Content-Range', 'Accept-Ranges', 'Retry-After'],
    maxAge: 600,
  });
  app.enableShutdownHooks();

  setImmediate(preloadGeoip);
  await app.listen(config.env.API_PORT, '0.0.0.0');
  logger.log(`FormGL API listening on http://localhost:${config.env.API_PORT}/api (${config.env.NODE_ENV})`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
