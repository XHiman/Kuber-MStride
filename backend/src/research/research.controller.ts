import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ResearchService } from './research.service';

/** Public, unauthenticated endpoints: payloads are anonymous and whitelisted (see research-input.ts). */
@Controller('research')
export class ResearchController {
  constructor(private research: ResearchService) {}

  @Post('events')
  @HttpCode(202)
  events(@Body() body: unknown) {
    return this.research.recordEvents(body);
  }

  @Post('feedback')
  feedback(@Body() body: unknown) {
    return this.research.recordFeedback(body);
  }
}
