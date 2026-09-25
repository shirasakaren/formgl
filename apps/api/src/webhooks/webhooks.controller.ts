import { Body, Controller, Delete, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import type { z } from 'zod';
import { AdminGuard } from '../auth/admin.guard';
import { UuidParam, ZodPipe } from '../common/validation';
import { CreateWebhookBody, PatchWebhookBody, WebhooksService } from './webhooks.service';

@Controller('admin')
@UseGuards(AdminGuard)
export class WebhooksController {
  constructor(private readonly hooks: WebhooksService) {}

  @Get('forms/:id/webhooks')
  list(@UuidParam('id') id: string) {
    return this.hooks.list(id);
  }

  @Post('forms/:id/webhooks')
  create(@UuidParam('id') id: string, @Body(new ZodPipe(CreateWebhookBody)) body: z.infer<typeof CreateWebhookBody>) {
    return this.hooks.create(id, body);
  }

  @Patch('webhooks/:wid')
  update(@UuidParam('wid') wid: string, @Body(new ZodPipe(PatchWebhookBody)) body: z.infer<typeof PatchWebhookBody>) {
    return this.hooks.update(wid, body);
  }

  @Delete('webhooks/:wid')
  remove(@UuidParam('wid') wid: string) {
    return this.hooks.remove(wid);
  }

  @Post('webhooks/:wid/rotate')
  @HttpCode(200)
  rotate(@UuidParam('wid') wid: string) {
    return this.hooks.rotateSecret(wid);
  }

  @Post('webhooks/:wid/test')
  @HttpCode(200)
  test(@UuidParam('wid') wid: string) {
    return this.hooks.test(wid);
  }

  @Get('webhooks/:wid/deliveries')
  deliveries(@UuidParam('wid') wid: string) {
    return this.hooks.deliveries(wid);
  }
}
