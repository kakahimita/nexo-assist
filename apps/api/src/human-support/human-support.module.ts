import { Module } from '@nestjs/common';
import { TicketsModule } from '../tickets/tickets.module.js';
import { HumanSupportController } from './human-support.controller.js';
import { HumanSupportService } from './human-support.service.js';

@Module({
  imports: [TicketsModule],
  controllers: [HumanSupportController],
  providers: [HumanSupportService],
})
export class HumanSupportModule {}
