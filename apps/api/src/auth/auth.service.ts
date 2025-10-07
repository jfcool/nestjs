import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as bcrypt from 'bcrypt';
import { DATABASE_CONNECTION } from '../database/database.module';
import * as schema from '../database/schema';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.username, username),
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
      },
    });

    if (user && user.passwordHash && await bcrypt.compare(password, user.passwordHash)) {
      const { passwordHash, ...result } = user;
      // Transform userRoles to roles format for compatibility
      const roles = user.userRoles.map(ur => ur.role);
      return { ...result, roles };
    }
    return null;
  }

  async login(user: any) {
    const roles = user.roles || [];
    const payload = { 
      username: user.username, 
      sub: user.id,
      roles: roles.map(role => role.name),
      permissions: this.getUserPermissions(roles)
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        roles: roles.map(role => ({
          id: role.id,
          name: role.name,
          permissions: role.permissions
        })),
        permissions: this.getUserPermissions(roles)
      }
    };
  }

  private getUserPermissions(roles: any[]): string[] {
    const permissions = new Set<string>();
    roles.forEach(role => {
      if (Array.isArray(role.permissions)) {
        role.permissions.forEach(permission => permissions.add(permission));
      }
    });
    return Array.from(permissions);
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async createUser(userData: {
    username: string;
    password: string;
    name: string;
    email?: string;
    roleIds?: number[];
  }) {
    const passwordHash = await this.hashPassword(userData.password);
    
    return await this.db.transaction(async (tx) => {
      // Create user
      const [user] = await tx
        .insert(schema.users)
        .values({
          username: userData.username,
          passwordHash,
          name: userData.name,
          email: userData.email ?? null,
        })
        .returning();

      // Assign roles if provided
      if (userData.roleIds && userData.roleIds.length > 0) {
        const userRoleValues = userData.roleIds.map(roleId => ({
          userId: user.id,
          roleId: roleId,
        }));
        await tx.insert(schema.userRoles).values(userRoleValues);
      }

      return user;
    });
  }

  async findUserById(id: number) {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, id),
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
      },
    });

    if (!user) return null;

    // Transform userRoles to roles format for compatibility
    const roles = user.userRoles.map(ur => ur.role);
    return { ...user, roles };
  }

  async findUserByUsername(username: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.username, username),
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
      },
    });

    if (!user) return null;

    // Transform userRoles to roles format for compatibility
    const roles = user.userRoles.map(ur => ur.role);
    return { ...user, roles };
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('User not found or no password set');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password and update
    const newPasswordHash = await this.hashPassword(newPassword);
    await this.db
      .update(schema.users)
      .set({ passwordHash: newPasswordHash })
      .where(eq(schema.users.id, userId));

    return { message: 'Password changed successfully' };
  }
}
