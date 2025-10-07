import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CONNECTION } from '../database/database.module';
import * as schema from '../database/schema';
import { UserDto } from './user.dto';
import { CreateUserDto } from './create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async findAll(): Promise<UserDto[]> {
    const users = await this.db.select().from(schema.users);
    return users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
    }));
  }

  async create(dto: CreateUserDto): Promise<UserDto> {
    const [user] = await this.db
      .insert(schema.users)
      .values({
        name: dto.name,
        email: dto.email ?? null,
      })
      .returning();
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }

  async findById(id: number): Promise<UserDto | null> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    
    if (!user) {
      return null;
    }
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }

  async update(id: number, dto: Partial<CreateUserDto>): Promise<UserDto | null> {
    const updateData: Partial<typeof schema.users.$inferInsert> = {};
    
    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }
    if (dto.email !== undefined) {
      updateData.email = dto.email ?? null;
    }

    if (Object.keys(updateData).length === 0) {
      return this.findById(id);
    }

    const [updatedUser] = await this.db
      .update(schema.users)
      .set(updateData)
      .where(eq(schema.users.id, id))
      .returning();
    
    if (!updatedUser) {
      return null;
    }
    
    return {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
    };
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(schema.users)
      .where(eq(schema.users.id, id))
      .returning();
    
    return result.length > 0;
  }
}
