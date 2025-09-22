import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsService } from './permissions.service';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@Controller('permissions')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  @Get('available')
  @RequirePermissions('permissions')
  getAvailablePermissions() {
    return {
      permissions: this.permissionsService.getAvailablePermissions()
    };
  }

  @Get('roles')
  @RequirePermissions('permissions')
  async getAllRoles() {
    return this.permissionsService.getAllRoles();
  }

  @Get('roles/:id')
  @RequirePermissions('permissions')
  async getRoleById(@Param('id') id: number) {
    return this.permissionsService.getRoleById(id);
  }

  @Post('roles')
  @RequirePermissions('permissions')
  async createRole(@Body() roleData: {
    name: string;
    description?: string;
    permissions: string[];
  }) {
    return this.permissionsService.createRole(roleData);
  }

  @Put('roles/:id')
  @RequirePermissions('permissions')
  async updateRole(
    @Param('id') id: number,
    @Body() roleData: {
      name?: string;
      description?: string;
      permissions?: string[];
    }
  ) {
    return this.permissionsService.updateRole(id, roleData);
  }

  @Delete('roles/:id')
  @RequirePermissions('permissions')
  async deleteRole(@Param('id') id: number) {
    await this.permissionsService.deleteRole(id);
    return { message: 'Role deleted successfully' };
  }

  @Get('users')
  @RequirePermissions('permissions')
  async getUsersWithRoles() {
    return this.permissionsService.getUsersWithRoles();
  }

  @Post('users/:userId/roles')
  @RequirePermissions('permissions')
  async assignRolesToUser(
    @Param('userId') userId: number,
    @Body() body: { roleIds: number[] }
  ) {
    return this.permissionsService.assignRolesToUser(userId, body.roleIds);
  }

  @Delete('users/:userId/roles/:roleId')
  @RequirePermissions('permissions')
  async removeRoleFromUser(
    @Param('userId') userId: number,
    @Param('roleId') roleId: number
  ) {
    return this.permissionsService.removeRoleFromUser(userId, roleId);
  }
}
