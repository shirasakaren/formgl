import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { AdminGuard } from '../auth/admin.guard';
import { parseOrThrow, UuidParam, ZodPipe } from '../common/validation';
import { BulkDeleteBody, ListQuery, PatchResponseBody, ResponsesService } from './responses.service';

const ExportQuery = z.object({ format: z.enum(['csv', 'json']).default('csv') });

@Controller('admin')
@UseGuards(AdminGuard)
export class ResponsesController {
  constructor(private readonly responses: ResponsesService) {}

  @Get('forms/:id/responses')
  list(@UuidParam('id') id: string, @Query() query: Record<string, unknown>) {
    return this.responses.list(id, parseOrThrow(ListQuery, query, 'query'));
  }

  @Get('forms/:id/responses/all')
  all(@UuidParam('id') id: string) {
    return this.responses.all(id);
  }

  @Post('forms/:id/responses/bulk-delete')
  @HttpCode(200)
  bulkDelete(@UuidParam('id') id: string, @Body(new ZodPipe(BulkDeleteBody)) body: z.infer<typeof BulkDeleteBody>) {
    return this.responses.bulkDelete(id, body.ids);
  }

  @Patch('responses/:rid')
  update(@UuidParam('rid') rid: string, @Body(new ZodPipe(PatchResponseBody)) body: z.infer<typeof PatchResponseBody>) {
    return this.responses.update(rid, body);
  }

  @Delete('responses/:rid')
  remove(@UuidParam('rid') rid: string) {
    return this.responses.remove(rid);
  }

  @Get('forms/:id/export')
  async export(@UuidParam('id') id: string, @Query() query: Record<string, unknown>, @Res() res: Response) {
    const { format } = parseOrThrow(ExportQuery, query, 'query');
    const file = await this.responses.export(id, format);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename.replace(/[^\w.-]/g, '_')}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(file.body);
  }
}
