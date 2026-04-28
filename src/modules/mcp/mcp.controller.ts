import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import {
  GetBottleneckSnapshotDto,
  GetDelaysByRoleDto,
  McpLoginDto,
} from './dto';
import { GetRejectionFunnelDto } from './dto/get-rejection-funnel.dto';
import { GetRoleWorkloadAndPerformanceDto } from './dto/get-role-workload-and-performance.dto';
import { GetUserNotificationEffectivenessDto } from './dto/get-user-notification-effectiveness.dto';
import { McpService } from './mcp.service';

@Controller('mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Post('auth/login')
  login(@Body() loginDto: McpLoginDto) {
    return this.mcpService.login(loginDto);
  }

  @Get('get_delays_by_role')
  getDelaysByRole(@Query() query: GetDelaysByRoleDto) {
    return this.mcpService.getDelaysByRole(query);
  }

  @Get('get_bottleneck_snapshot')
  getBottleneckSnapshot(@Query() query: GetBottleneckSnapshotDto) {
    return this.mcpService.getBottleneckSnapshot(query);
  }

  @Get('get_role_workload_and_performance')
  getRoleWorkloadAndPerformance(
    @Query() query: GetRoleWorkloadAndPerformanceDto,
  ) {
    return this.mcpService.getRoleWorkloadAndPerformance(query);
  }

  @Get('get_rejection_funnel')
  getRejectionFunnel(@Query() query: GetRejectionFunnelDto) {
    return this.mcpService.getRejectionFunnel(query);
  }

  @Get('get_user_notification_effectiveness')
  async getUserNotificationEffectiveness(
    @Query() query: GetUserNotificationEffectivenessDto,
  ): Promise<unknown> {
    return await this.mcpService.getUserNotificationEffectiveness(query);
  }
}
