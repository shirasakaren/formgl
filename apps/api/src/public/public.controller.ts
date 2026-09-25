import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import type { Request, Response } from 'express';
import { parseOrThrow } from '../common/validation';
import { MemoryUpload } from '../files/upload';
import { RateLimit } from '../redis/rate-limit';
import { PublicService, SubmitBody, TrackEventBody, UploadBody } from './public.service';

/** sendBeacon posts text/plain — accept a JSON string body too */
function jsonBody(body: unknown): unknown {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body ?? {};
}

@Controller('public/forms')
export class PublicController {
  constructor(private readonly pub: PublicService) {}

  @Get(':slug')
  async get(
    @Param('slug') slug: string,
    @Query('preview') preview: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { form, cacheable } = await this.pub.getForm(slug, preview === '1' || preview === 'true', req);
    res.setHeader('Cache-Control', cacheable ? 'public, max-age=0, s-maxage=30, must-revalidate' : 'no-store');
    return form;
  }

  @Post(':slug/events')
  @HttpCode(204)
  @RateLimit({ name: 'events', limit: 120, windowSec: 60 })
  async track(@Param('slug') slug: string, @Body() body: unknown, @Req() req: Request) {
    await this.pub.track(slug, parseOrThrow(TrackEventBody, jsonBody(body), 'event'), req);
  }

  @Post(':slug/responses')
  @HttpCode(200)
  @RateLimit({ name: 'submit', limit: 10, windowSec: 60, message: 'Too many submissions — please wait a minute.' })
  submit(@Param('slug') slug: string, @Body() body: unknown, @Req() req: Request) {
    return this.pub.submit(slug, parseOrThrow(SubmitBody, jsonBody(body), 'submission'), req);
  }

  @Post(':slug/uploads')
  @HttpCode(200)
  @RateLimit({ name: 'upload', limit: 30, windowSec: 60, message: 'Too many uploads — please wait a minute.' })
  @UseInterceptors(MemoryUpload('file', (cfg) => cfg.maxUploadBytes))
  upload(@Param('slug') slug: string, @UploadedFile() file: Express.Multer.File | undefined, @Body() body: unknown) {
    return this.pub.upload(slug, file, parseOrThrow(UploadBody, body ?? {}, 'upload'));
  }
}
