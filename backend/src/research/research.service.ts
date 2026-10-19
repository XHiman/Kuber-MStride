import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { cleanEvents, cleanFeedback } from './research-input';

@Injectable()
export class ResearchService {
  constructor(private prisma: PrismaService) {}

  /** Usage logging is off unless the server explicitly enables it, whatever the client sends. */
  get loggingEnabled(): boolean {
    return process.env.RESEARCH_LOG_ENABLED === 'true';
  }

  async recordEvents(body: unknown): Promise<{ stored: number }> {
    if (!this.loggingEnabled) return { stored: 0 };
    const events = cleanEvents(body);
    if (events.length) await this.prisma.usageEvent.createMany({ data: events });
    return { stored: events.length };
  }

  async recordFeedback(body: unknown): Promise<{ saved: true }> {
    await this.prisma.feedback.create({ data: cleanFeedback(body) });
    return { saved: true };
  }

  async export() {
    const [events, feedback] = await Promise.all([
      this.prisma.usageEvent.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.feedback.findMany({ orderBy: { createdAt: 'asc' } }),
    ]);
    return { exportedAt: new Date().toISOString(), loggingEnabled: this.loggingEnabled, events, feedback };
  }
}
