import { Injectable } from '@nestjs/common';
import { getEnv, type Env } from './env';

/** Typed, validated view over the environment (validated by ConfigModule at boot). */
@Injectable()
export class AppConfig {
  readonly env: Env = getEnv();

  get isProd() {
    return this.env.NODE_ENV === 'production';
  }
  get webOrigins(): string[] {
    return this.env.WEB_ORIGIN.split(',')
      .map((s) => s.trim().replace(/\/$/, ''))
      .filter(Boolean);
  }
  get trustProxy(): boolean {
    return this.env.TRUST_PROXY !== false;
  }
  get maxUploadBytes() {
    return Math.floor(this.env.MAX_UPLOAD_MB * 1024 * 1024);
  }
}
