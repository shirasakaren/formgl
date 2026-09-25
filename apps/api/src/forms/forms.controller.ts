import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { z } from 'zod';
import { AdminGuard } from '../auth/admin.guard';
import { UUID_RE, UuidParam, ZodPipe } from '../common/validation';
import { CreateFormBody, FormsService, PatchFormBody, PublishBody } from './forms.service';

@Controller('admin')
@UseGuards(AdminGuard)
export class FormsController {
  constructor(private readonly forms: FormsService) {}

  @Get('forms')
  list() {
    return this.forms.list();
  }

  @Post('forms')
  create(@Body(new ZodPipe(CreateFormBody)) body: z.infer<typeof CreateFormBody>) {
    return this.forms.create(body);
  }

  @Get('forms/:id')
  get(@UuidParam('id') id: string) {
    return this.forms.get(id);
  }

  @Patch('forms/:id')
  update(@UuidParam('id') id: string, @Body(new ZodPipe(PatchFormBody)) body: z.infer<typeof PatchFormBody>) {
    return this.forms.update(id, body);
  }

  @Post('forms/:id/publish')
  @HttpCode(200)
  publish(@UuidParam('id') id: string, @Body(new ZodPipe(PublishBody)) body: z.infer<typeof PublishBody>) {
    return this.forms.publish(id, body.slug);
  }

  @Post('forms/:id/unpublish')
  @HttpCode(200)
  unpublish(@UuidParam('id') id: string) {
    return this.forms.setStatus(id, 'draft');
  }

  @Post('forms/:id/close')
  @HttpCode(200)
  close(@UuidParam('id') id: string) {
    return this.forms.setStatus(id, 'closed');
  }

  @Post('forms/:id/duplicate')
  @HttpCode(200)
  duplicate(@UuidParam('id') id: string) {
    return this.forms.duplicate(id);
  }

  @Delete('forms/:id')
  remove(@UuidParam('id') id: string) {
    return this.forms.remove(id);
  }

  @Get('slugs/check')
  checkSlug(@Query('slug') slug?: string, @Query('formId') formId?: string) {
    if (formId && !UUID_RE.test(formId)) throw new BadRequestException('Invalid formId: expected a UUID');
    return this.forms.checkSlug(typeof slug === 'string' ? slug : '', formId || undefined);
  }
}
