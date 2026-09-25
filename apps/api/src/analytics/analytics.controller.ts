import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { parseOrThrow, UuidParam } from '../common/validation';
import { AnalyticsQuery, AnalyticsService, EventsQuery } from './analytics.service';

@Controller('admin')
@UseGuards(AdminGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview() {
    return this.analytics.overview();
  }

  @Get('forms/:id/analytics')
  summary(@UuidParam('id') id: string, @Query() query: Record<string, unknown>) {
    return this.analytics.summary(id, parseOrThrow(AnalyticsQuery, query, 'query'));
  }

  @Get('forms/:id/events')
  events(@UuidParam('id') id: string, @Query() query: Record<string, unknown>) {
    return this.analytics.events(id, parseOrThrow(EventsQuery, query, 'query'));
  }
}
