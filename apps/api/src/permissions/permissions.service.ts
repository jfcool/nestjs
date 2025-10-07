import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CONNECTION } from '../database/database.module';
import * as schema from '../database/schema';

@Injectable()
export class PermissionsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  // Available permissions in the system
  private readonly availablePermissions = [
    'dashboard',
    'users',
    'sapodata',
    'chat',
    'permissions'
  ];

  async getAllRoles() {
    return await this.db.query.roles.findMany({
      with: {
        userRoles: {
          with: {
            user: true,
          },
        },
      },
    });
  }

  async getRoleById(id: number) {
    const role = await this.db.query.roles.findFirst({
      where: eq(schema.roles.id, id),
      with: {
        userRoles: {
          with: {
            user: true,
          },
        },
      },
    });
    
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    
    return role;
  }

  async createRole(roleData: {
    name: string;
    description?: string;
    permissions: string[];
  }) {
    // Validate permissions
    const invalidPermissions = roleData.permissions.filter(
      permission => !this.availablePermissions.includes(permission)
    );
    
    if (invalidPermissions.length > 0) {
      throw new BadRequestException(`Invalid permissions: ${invalidPermissions.join(', ')}`);
    }

    // Check if role name already exists
    const existingRole = await this.db.query.roles.findFirst({
      where: eq(schema.roles.name, roleData.name),
    });
    
    if (existingRole) {
      throw new BadRequestException(`Role with name '${roleData.name}' already exists`);
    }

    const [role] = await this.db
      .insert(schema.roles)
      .values({
        name: roleData.name,
        description: roleData.description ?? null,
        permissions: roleData.permissions,
      })
      .returning();
    
    return role;
  }

  async updateRole(id: number, roleData: {
    name?: string;
    description?: string;
    permissions?: string[];
  }) {
    const role = await this.getRoleById(id);

    if (roleData.permissions) {
      // Validate permissions
      const invalidPermissions = roleData.permissions.filter(
        permission => !this.availablePermissions.includes(permission)
      );
      
      if (invalidPermissions.length > 0) {
        throw new BadRequestException(`Invalid permissions: ${invalidPermissions.join(', ')}`);
      }
    }

    if (roleData.name && roleData.name !== role.name) {
      // Check if new name already exists
      const existingRole = await this.db.query.roles.findFirst({
        where: eq(schema.roles.name, roleData.name),
      });
      
      if (existingRole) {
        throw new BadRequestException(`Role with name '${roleData.name}' already exists`);
      }
    }

    const updateData: Partial<typeof schema.roles.$inferInsert> = {};
    if (roleData.name !== undefined) updateData.name = roleData.name;
    if (roleData.description !== undefined) updateData.description = roleData.description;
    if (roleData.permissions !== undefined) updateData.permissions = roleData.permissions;

    const [updatedRole] = await this.db
      .update(schema.roles)
      .set(updateData)
      .where(eq(schema.roles.id, id))
      .returning();
    
    return updatedRole;
  }

  async deleteRole(id: number): Promise<void> {
    const role = await this.getRoleById(id);
    await this.db
      .delete(schema.roles)
      .where(eq(schema.roles.id, id));
  }

  async assignRolesToUser(userId: number, roleIds: number[]) {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });
    
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Validate that all role IDs exist
    const roles = await this.db
      .select()
      .from(schema.roles)
      .where(inArray(schema.roles.id, roleIds));
    
    if (roles.length !== roleIds.length) {
      const foundIds = roles.map(role => role.id);
      const missingIds = roleIds.filter(id => !foundIds.includes(id));
      throw new BadRequestException(`Roles not found: ${missingIds.join(', ')}`);
    }

    await this.db.transaction(async (tx) => {
      // Remove existing role assignments
      await tx
        .delete(schema.userRoles)
        .where(eq(schema.userRoles.userId, userId));
      
      // Add new role assignments
      if (roleIds.length > 0) {
        const userRoleValues = roleIds.map(roleId => ({
          userId,
          roleId,
        }));
        await tx.insert(schema.userRoles).values(userRoleValues);
      }
    });

    // Return updated user with roles
    return await this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
      },
    });
  }

  async removeRoleFromUser(userId: number, roleId: number) {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });
    
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    await this.db
      .delete(schema.userRoles)
      .where(
        eq(schema.userRoles.userId, userId) && eq(schema.userRoles.roleId, roleId)
      );

    // Return updated user with roles
    return await this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
      },
    });
  }

  async getUsersWithRoles() {
    return await this.db.query.users.findMany({
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
      },
    });
  }

  getAvailablePermissions(): string[] {
    return [...this.availablePermissions];
  }
}
