# AI Development Guidelines for NestJS + Next.js Monorepo

## 🎯 Project Overview

This is a NestJS + Next.js monorepo with **System Modules** for user management, permissions, and communication. All feature modules MUST use these system modules instead of implementing their own solutions.

### Core Architecture
- **Backend**: NestJS (TypeScript, PostgreSQL, TypeORM)
- **Frontend**: Next.js 15 + React 19 + TailwindCSS + Radix UI
- **Tooling**: pnpm + Turborepo + Orval (OpenAPI Code Generation)

---

## 🏗️ System Modules (MANDATORY)

### 1. Users Module (`apps/api/src/users/`)
**Purpose**: Central user management system

**Key Components:**
- `User` entity with UUID primary keys
- `UsersService` for all user operations
- `UsersController` with full CRUD operations
- Automatic seeding via `seed-users.ts`

**Usage Rule**: ALL modules requiring user data MUST use `UsersService`. Never create separate user entities.

```typescript
// ✅ CORRECT - Use UsersService
constructor(private readonly usersService: UsersService) {}

// ❌ FORBIDDEN - Don't create own user logic
@Entity('my_users') // NEVER DO THIS
```

### 2. Auth Module (`apps/api/src/auth/`)
**Purpose**: Authentication and authorization system

**Key Components:**
- JWT Strategy with Passport
- Role-based permissions system
- `@Permissions()` decorator for endpoint protection
- `PermissionsGuard` for access control

**Usage Rule**: ALL protected endpoints MUST use the auth system. Never implement custom authentication.

```typescript
// ✅ CORRECT - Use auth decorators
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('read:users')
@Get()

// ❌ FORBIDDEN - Don't create custom auth
if (req.headers.authorization) { // NEVER DO THIS
```

### 3. Permissions Module (`apps/api/src/permissions/`)
**Purpose**: Centralized permission management

**Key Components:**
- `Role` entity with permission arrays
- `PermissionsService` for role management
- Integration with auth guards

**Usage Rule**: ALL access control MUST use the permissions system.

---

## 🔄 Communication System (MANDATORY)

### API Client (`packages/api-types/`)
**Purpose**: Type-safe API communication

**Key Components:**
- Auto-generated TypeScript types from OpenAPI
- React Query hooks for all API calls
- Custom fetch configuration in `fetcher.ts`

### STRICT RULES:

#### ✅ ALLOWED - Use Generated Hooks
```typescript
// Frontend - Use generated hooks
const { data, isLoading } = useGetUsers();
const createMutation = useCreateUser();

// Backend - Use services
constructor(private readonly usersService: UsersService) {}
```

#### ❌ FORBIDDEN - Direct Fetch/HTTP Calls
```typescript
// NEVER DO THESE:
fetch('/api/users') // FORBIDDEN
axios.get('/api/users') // FORBIDDEN
http.get('/api/users') // FORBIDDEN

// Don't bypass the system:
const response = await fetch(...) // FORBIDDEN
```

### Code Generation Workflow
```bash
# After backend changes, ALWAYS run:
pnpm gen:client
```

---

## 🔧 Development Rules for AI

### 1. Module Dependencies
```typescript
// ✅ CORRECT - Import system modules
import { UsersService } from '../users/users.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

// ❌ FORBIDDEN - Don't recreate system functionality
@Injectable()
export class MyCustomUserService { // NEVER CREATE THIS
```

### 2. Entity Patterns
```typescript
// ✅ CORRECT - Standard entity pattern
@Entity('table_name')
export class Example {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### 3. Controller Patterns
```typescript
// ✅ CORRECT - Use system modules
@Controller('example')
export class ExampleController {
  private readonly logger = new Logger(ExampleController.name);

  constructor(
    private readonly exampleService: ExampleService,
    private readonly usersService: UsersService, // Use system module
  ) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard) // Use auth system
  @Permissions('read:example') // Use permissions system
  @Post()
  async create(@Body() dto: CreateExampleDto) {
    this.logger.log('Creating example');
    return this.exampleService.create(dto);
  }
}
```

### 4. Service Patterns
```typescript
// ✅ CORRECT - Inject system services
@Injectable()
export class ExampleService {
  constructor(
    @InjectRepository(Example)
    private readonly exampleRepository: Repository<Example>,
    private readonly usersService: UsersService, // Use system module
  ) {}

  async create(dto: CreateExampleDto) {
    // Use system services for user operations
    const user = await this.usersService.findById(dto.userId);
    // Your business logic here
  }
}
```

### 5. Frontend Component Patterns
```typescript
// ✅ CORRECT - Use generated hooks
'use client';
import { useGetUsers, useCreateUser } from '@acme/api-types';

export default function ExamplePage() {
  const { data: users, isLoading } = useGetUsers(); // Use generated hook
  const createMutation = useCreateUser(); // Use generated hook

  // ❌ FORBIDDEN - Don't use direct fetch
  // useEffect(() => {
  //   fetch('/api/users') // NEVER DO THIS
  // }, []);

  return <div>{/* Component JSX */}</div>;
}
```

---

## 🚫 Forbidden Patterns

### 1. Custom User Management
```typescript
// ❌ FORBIDDEN - Don't create user entities
@Entity('custom_users')
export class CustomUser {} // NEVER CREATE

// ❌ FORBIDDEN - Don't create user services
@Injectable()
export class CustomUserService {} // NEVER CREATE
```

### 2. Custom Authentication
```typescript
// ❌ FORBIDDEN - Don't create auth logic
const isAuthenticated = (token) => { // NEVER CREATE
  // Custom auth logic
};

// ❌ FORBIDDEN - Don't create custom guards
@Injectable()
export class CustomAuthGuard {} // NEVER CREATE
```

### 3. Direct HTTP Calls
```typescript
// ❌ FORBIDDEN - Don't bypass API client
fetch('/api/endpoint') // NEVER DO
axios.get('/api/endpoint') // NEVER DO
http.request('/api/endpoint') // NEVER DO
```

### 4. Custom Permission Systems
```typescript
// ❌ FORBIDDEN - Don't create permission logic
const hasPermission = (user, action) => { // NEVER CREATE
  // Custom permission logic
};
```

---

## 📋 AI Development Checklist

When creating new features, ALWAYS verify:

### Backend Checklist
- [ ] Uses `UsersService` for user operations
- [ ] Uses `@UseGuards(JwtAuthGuard, PermissionsGuard)` for protection
- [ ] Uses `@Permissions('action:resource')` decorator
- [ ] Follows standard entity pattern with UUID
- [ ] Has proper logging with `Logger`
- [ ] Uses dependency injection for system modules

### Frontend Checklist
- [ ] Uses generated hooks from `@acme/api-types`
- [ ] NO direct fetch/axios/http calls
- [ ] Proper error handling with React Query
- [ ] Uses Radix UI components
- [ ] Follows responsive design patterns

### Navigation Checklist
- [ ] **MANDATORY**: Each new module MUST have a navigation entry in `Navigation.tsx`
- [ ] Navigation entry includes proper permission check
- [ ] Translation keys added for navigation labels
- [ ] Icon assigned for visual identification
- [ ] Route properly configured in the routes array

### Integration Checklist
- [ ] Runs `pnpm gen:client` after backend changes
- [ ] Tests API endpoints via generated hooks
- [ ] Verifies permissions work correctly
- [ ] Checks user operations use system modules
- [ ] **Navigation entry visible and functional**

---

## 🎯 Key Commands for AI

```bash
# Start development
pnpm dev

# Generate API client (MANDATORY after backend changes)
pnpm gen:client

# Build project
pnpm build
```

---

## 🔒 Security Rules

1. **NEVER** bypass the auth system
2. **ALWAYS** use `@Permissions()` decorator for protected endpoints
3. **NEVER** create custom user/auth/permission logic
4. **ALWAYS** validate inputs with DTOs
5. **NEVER** use direct HTTP calls in frontend

---

## 📝 Error Handling Patterns

### Backend
```typescript
try {
  const result = await this.systemService.operation();
  return result;
} catch (error) {
  this.logger.error(`Operation failed: ${error.message}`);
  throw new HttpException('Operation failed', HttpStatus.INTERNAL_SERVER_ERROR);
}
```

### Frontend
```typescript
const { data, isLoading, isError, error } = useGeneratedHook();

if (isError) {
  return <ErrorComponent message={error?.message} />;
}
```

---

## 🌐 Internationalization (i18n) System (MANDATORY)

### Language Support
- **Supported Languages**: English (`en`), German (`de`)
- **Default Language**: English
- **Technology**: Next.js i18n with custom translation system

### Translation Rules

#### ✅ ALLOWED - Use Translation System
```typescript
// Use translation hook
const { t, locale, changeLanguage } = useTranslation();

// Translate text
<h1>{t('users.title')}</h1>
<p>{t('users.usersLoaded', { count: users.length })}</p>

// Change language
changeLanguage('de');
```

#### ❌ FORBIDDEN - Hardcoded Text
```typescript
// NEVER use hardcoded text
<h1>User Management</h1> // FORBIDDEN
<p>Welcome to the system</p> // FORBIDDEN
toast({ title: "Success" }) // FORBIDDEN
```

### Translation File Structure
```json
{
  "common": {
    "loading": "Loading...",
    "error": "Error",
    "save": "Save"
  },
  "users": {
    "title": "User Management",
    "addUser": "Add User"
  }
}
```

### Implementation Requirements
1. **ALL UI text** MUST use translation keys
2. **NO hardcoded strings** in components
3. **Parameter interpolation** for dynamic content: `{{count}}`
4. **Language switcher** available in navigation
5. **Consistent translation keys** across components

---

## 🎯 Summary for AI

**CORE PRINCIPLE**: Use system modules (users, auth, permissions) for ALL functionality. Never recreate these systems.

**COMMUNICATION RULE**: Use generated API hooks. NEVER use direct fetch/axios/http calls.

**INTERNATIONALIZATION RULE**: Use translation system for ALL text. NEVER use hardcoded strings.

**DEVELOPMENT FLOW**: 
1. Modify backend → 2. Run `pnpm gen:client` → 3. Use generated hooks in frontend
4. Add translation keys → 5. Use `t('key')` for all text

**FORBIDDEN ACTIONS**:
- Creating custom user/auth/permission systems
- Direct HTTP calls bypassing the API client
- Hardcoded text strings in UI components
- Ignoring the established patterns

Follow these guidelines strictly to maintain system integrity and consistency.
