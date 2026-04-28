import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { GetDelaysByRoleDto, McpLoginDto } from './dto';
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
}
