# Drizzle ORM Migration Guide

This document outlines the migration from TypeORM to Drizzle ORM for the NestJS API.

## Overview

The project has been migrated from TypeORM to Drizzle ORM with SQL migrations. This provides:
- Better TypeScript type safety with schema inference
- More control over SQL generation
- Simpler, more explicit migration workflow
- Better performance with postgres driver
- Full support for pgvector operations

## Architecture

### Database Schema Structure

```
apps/api/src/database/
├── schema/
│   ├── enums.ts           # PostgreSQL enum definitions
│   ├── users.ts           # Users table schema
│   ├── roles.ts           # Roles table schema
│   ├── user-roles.ts      # Many-to-many junction table
│   ├── conversations.ts   # Conversations table
│   ├── messages.ts        # Messages table
│   ├── documents.ts       # Documents table with metadata
│   ├── chunks.ts          # Text chunks with pgvector embeddings
│   ├── connections.ts     # SAP/AgentDB connections
│   ├── secrets.ts         # Encrypted secrets
│   └── index.ts           # Schema exports
├── migrations/
│   ├── 0000_initial_schema.sql      # Database schema
│   └── 0001_seed_initial_data.sql   # Seed data
├── database.module.ts     # NestJS Drizzle module
└── migrate.ts             # Migration runner script
```

### Key Features

1. **Schema Definition**: All tables defined using Drizzle's type-safe schema API
2. **Custom Types**: pgvector support via customType helper (vector(768) for embeddings)
3. **Relations**: Explicit relation definitions for type-safe joins
4. **Indexes**: GIN, IVFFlat (vector), and B-tree indexes
5. **Enums**: PostgreSQL enum types for roles, connection types, etc.

## Database Commands

### Running Migrations

```bash
# Run all migrations (creates schema + seeds data)
pnpm db:migrate

# Push schema changes directly (for development)
pnpm db:push

# Open Drizzle Studio (database browser)
pnpm db:studio
```

### Migration Script Details

The `db:migrate` command:
1. Connects to PostgreSQL
2. Runs `0000_initial_schema.sql` (creates all tables, indexes, extensions)
3. Generates bcrypt hashes for seed users
4. Runs `0001_seed_initial_data.sql` (inserts initial data)
5. Reports success with account credentials

## Schema Changes

### Before (TypeORM)
```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;
  
  @Column()
  name: string;
  
  @ManyToMany(() => Role)
  @JoinTable()
  roles: Role[];
}
```

### After (Drizzle)
```typescript
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  // ...
});

export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

## Using the Database in Services

### Dependency Injection

```typescript
import { Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../database/schema';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}
  
  async findAll() {
    return await this.db.select().from(schema.users);
  }
  
  async findById(id: number) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    return user;
  }
  
  async create(data: NewUser) {
    const [user] = await this.db
      .insert(schema.users)
      .values(data)
      .returning();
    return user;
  }
}
```

### Common Query Patterns

#### Select with Relations
```typescript
const usersWithRoles = await this.db.query.users.findMany({
  with: {
    userRoles: {
      with: {
        role: true,
      },
    },
  },
});
```

#### Complex Queries
```typescript
import { eq, and, like, gt } from 'drizzle-orm';

const results = await this.db
  .select()
  .from(schema.documents)
  .where(
    and(
      eq(schema.documents.category, 'financial'),
      gt(schema.documents.importance, 1.5)
    )
  )
  .orderBy(desc(schema.documents.createdAt))
  .limit(10);
```

#### Transactions
```typescript
await this.db.transaction(async (tx) => {
  const [user] = await tx.insert(schema.users).values(newUser).returning();
  await tx.insert(schema.userRoles).values({
    userId: user.id,
    roleId: roleId,
  });
});
```

#### Raw SQL (for pgvector)
```typescript
const results = await this.db.execute(sql`
  SELECT 
    c.id,
    c.content,
    1 - (c.embedding <=> ${queryVector}::vector) as similarity
  FROM chunks c
  WHERE c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> ${queryVector}::vector) >= ${threshold}
  ORDER BY c.embedding <=> ${queryVector}::vector
  LIMIT ${limit}
`);
```

## Migration from TypeORM

### What Changed

1. **No Entity Decorators**: Plain TypeScript objects instead of classes
2. **Explicit Relations**: Relations defined separately from tables
3. **Type Inference**: No manual type definitions needed
4. **Query Builder**: Drizzle's select/insert/update API
5. **Migrations**: SQL-first approach instead of auto-generation

### Breaking Changes

- Remove all `@Entity`, `@Column`, `@ManyToOne`, etc. decorators
- Replace `@InjectRepository()` with `@Inject(DATABASE_CONNECTION)`
- Replace `Repository<Entity>` with `PostgresJsDatabase<typeof schema>`
- Update query syntax from QueryBuilder to Drizzle API
- Handle relations explicitly in queries

## Next Steps

### Service Layer Refactoring

Each service needs to be updated to use Drizzle:

1. **UsersService** - CRUD operations, role management
2. **AuthService** - Login, validation, JWT
3. **PermissionsService** - Role and permission management
4. **ChatService** - Conversations and messages
5. **DocumentServices** - Indexing, retrieval, classification
6. **SapServices** - Connection and secret management
7. **DashboardService** - Statistics and aggregations

### Testing

- Update unit tests to mock Drizzle DB
- Update e2e tests with new query patterns
- Verify vector similarity search accuracy
- Test all CRUD operations
- Validate transaction handling

## Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Drizzle with NestJS](https://orm.drizzle.team/docs/get-started-postgresql#nestjs)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Drizzle Studio](https://orm.drizzle.team/drizzle-studio/overview)

## Troubleshooting

### TypeScript Target Error
If you see "Invalid target ES2023" errors, ensure `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "target": "ES2021"
  }
}
```

### pgvector Type Issues
The custom vector type handles conversion between number[] and PostgreSQL vector type. Use raw SQL for complex vector operations.

### Migration Failures
- Ensure PostgreSQL is running
- Verify database credentials in .env
- Check pgvector extension is installed
- Run migrations with `pnpm db:migrate`

## Support

For issues or questions:
1. Check this documentation
2. Review Drizzle ORM docs
3. Examine existing service implementations
4. Test with Drizzle Studio
