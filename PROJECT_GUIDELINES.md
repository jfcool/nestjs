# AI Development Guidelines for NestJS + Next.js Monorepo

## 🎯 Project Overview

This is a **NestJS + Next.js monorepo** with **System Modules** for user management, permissions, and communication. All feature modules MUST use these system modules instead of implementing their own solutions.

### Core Architecture
- **Backend**: NestJS (TypeScript, PostgreSQL + pgvector, TypeORM)
- **Frontend**: Next.js 15 + React 19 + TailwindCSS + Radix UI
- **Infrastructure**: Docker Compose (PostgreSQL, PgAdmin, Ollama AI)
- **Tooling**: pnpm + Turborepo + Orval (OpenAPI Code Generation)
- **Testing**: Jest + Supertest (comprehensive test suite)
- **AI/ML**: Ollama for embeddings, pgvector for semantic search

---

## 🐳 Docker Infrastructure (MANDATORY)

### Docker Compose Setup
**Single Command Setup**: `docker-compose up -d`

**Services Included:**
- **PostgreSQL** (Port 5432) with pgvector extension
- **PgAdmin** (Port 8080) - Database management UI
- **Ollama** (Port 11434) - AI model server for embeddings
- **Automatic Initialization** - Database and AI models ready

### Docker Rules for AI Development

#### ✅ CORRECT - Use Docker Infrastructure
```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f ollama

# Stop services
docker-compose down
```

#### ❌ FORBIDDEN - Manual Setup
```bash
# NEVER manually install PostgreSQL
sudo apt install postgresql # FORBIDDEN

# NEVER manually setup pgvector
git clone pgvector && make install # FORBIDDEN

# NEVER manually install Ollama
curl -fsSL https://ollama.ai/install.sh | sh # FORBIDDEN
```

### Database Connection
```typescript
// ✅ CORRECT - Use Docker service names
const dataSource = new DataSource({
  host: 'nestjs-postgres', // Docker service name
  port: 5432,
  // ... other config
});

// ❌ FORBIDDEN - Hardcoded localhost
host: 'localhost', // FORBIDDEN in production
```

---

## 🧪 Testing System (MANDATORY)

### Jest Configuration
**Location**: `apps/api/jest.config.js`
**Test Database**: Separate test database with automatic cleanup

### Testing Rules

#### ✅ CORRECT - Use Jest Test Suite
```typescript
// Integration tests
describe('UsersController (e2e)', () => {
  beforeEach(async () => {
    await testUtilities.clearDatabase();
  });

  it('should create user', async () => {
    const response = await request(app.getHttpServer())
      .post('/users')
      .send(createUserDto)
      .expect(201);
  });
});

// Unit tests
describe('UsersService', () => {
  it('should find user by id', async () => {
    const user = await service.findById('uuid');
    expect(user).toBeDefined();
  });
});
```

#### ❌ FORBIDDEN - Ad-hoc Test Scripts
```javascript
// NEVER create standalone test files
// test-api.js - FORBIDDEN
// test-integration.js - FORBIDDEN
// manual-test.js - FORBIDDEN
```

### Test Commands
```bash
# Run all tests
npm test

# Run with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e

# Watch mode
npm run test:watch
```

---

## 🤖 AI/ML Integration (MANDATORY)

### Ollama AI Service
**Purpose**: Generate embeddings for semantic search
**Model**: nomic-embed-text (automatically loaded)
**Integration**: Via HTTP API to localhost:11434

### Vector Database (pgvector)
**Purpose**: Store and search document embeddings
**Extension**: Automatically installed in PostgreSQL
**Dimensions**: 768 (nomic-embed-text model)

### AI Development Rules

#### ✅ CORRECT - Use Ollama Service
```typescript
// Use embedding service
@Injectable()
export class EmbeddingService {
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch('http://nestjs-ollama:11434/api/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        prompt: text
      })
    });
    return response.json();
  }
}

// Use vector search
@Entity('document_chunks')
export class Chunk {
  @Column('vector', { length: 768 })
  embedding: number[];

  // Vector similarity search
  static async findSimilar(embedding: number[], limit = 10) {
    return this.createQueryBuilder('chunk')
      .orderBy('embedding <-> :embedding', 'ASC')
      .setParameter('embedding', `[${embedding.join(',')}]`)
      .limit(limit)
      .getMany();
  }
}
```

#### ❌ FORBIDDEN - External AI Services
```typescript
// NEVER use external AI APIs
const openaiResponse = await openai.embeddings.create(...); // FORBIDDEN
const response = await fetch('https://api.openai.com/...'); // FORBIDDEN
```

### Document Processing Pipeline
1. **Upload Document** → 2. **Parse Content** → 3. **Generate Chunks** → 4. **Create Embeddings** → 5. **Store in pgvector**

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

### 3. Documents Module (`apps/api/src/documents/`)
**Purpose**: Document management with AI-powered search

**Key Components:**
- `Document` entity for file metadata
- `Chunk` entity for text segments with embeddings
- `DocumentIndexingService` for AI processing
- `DocumentRetrievalService` for semantic search
- `EmbeddingService` for Ollama integration

**Usage Rule**: ALL document operations MUST use the documents system.

**CRITICAL DATABASE RULES:**
- **MANDATORY**: The `chunks` table `embedding` column MUST ALWAYS use PostgreSQL `vector` type, NEVER `text` type
- **FORBIDDEN**: TypeORM MUST NOT be used for the `chunks` table and `documents` table - use raw SQL queries only
- **REASON**: TypeORM cannot properly handle pgvector operations and causes `text <=> vector` errors

```typescript
// ✅ CORRECT - Raw SQL for vector operations
const chunks = await this.dataSource.query(`
  SELECT *, embedding <-> $1 as distance 
  FROM chunks 
  WHERE embedding IS NOT NULL 
  ORDER BY embedding <-> $1 
  LIMIT $2
`, [queryEmbedding, limit]);

// ❌ FORBIDDEN - TypeORM for chunks/documents
const chunks = await this.chunkRepository.find(); // NEVER USE
```

### 4. Chat Module (`apps/api/src/chat/`)
**Purpose**: AI-powered chat with document context

**Key Components:**
- `Conversation` and `Message` entities
- `ChatService` for conversation management
- `McpService` for AI model integration
- RAG (Retrieval-Augmented Generation) support

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

**CRITICAL API CLIENT RULES:**
- **MANDATORY**: Use ONLY the existing generated API client in `packages/api-types/`
- **FORBIDDEN**: NEVER create a new API client or rewrite the existing one
- **REASON**: The current API client is perfectly configured and tested - any changes will break the system

```typescript
// ✅ CORRECT - Use existing generated hooks
import { useGetUsers, useCreateUser } from '@acme/api-types';

// ❌ FORBIDDEN - Don't create new API clients
// custom-api-client.ts - NEVER CREATE
// new-fetch-client.ts - NEVER CREATE
// axios-client.ts - NEVER CREATE
```

---

## 📁 Project Structure (MANDATORY)

### Monorepo Layout
```
nestjs/
├── apps/
│   ├── api/                    # NestJS Backend
│   │   ├── src/
│   │   │   ├── users/         # System Module
│   │   │   ├── auth/          # System Module
│   │   │   ├── permissions/   # System Module
│   │   │   ├── documents/     # AI Document System
│   │   │   ├── chat/          # AI Chat System
│   │   │   └── migrations/    # Database Migrations
│   │   ├── test/              # Jest Test Suite
│   │   └── documents/         # Document Storage
│   └── web/                   # Next.js Frontend
├── packages/
│   └── api-types/             # Generated API Client
├── mcp-document-retrieval/    # MCP Server
├── docker-compose.yml         # Infrastructure
├── init-scripts/              # Database Init
└── PROJECT_GUIDELINES.md      # This File
```

### File Naming Conventions
- **Entities**: `user.entity.ts`, `document.entity.ts`
- **Services**: `users.service.ts`, `documents.service.ts`
- **Controllers**: `users.controller.ts`, `documents.controller.ts`
- **DTOs**: `create-user.dto.ts`, `update-user.dto.ts`
- **Tests**: `users.service.spec.ts`, `users.controller.spec.ts`
- **Migrations**: `1727200000000-SetupPgVector.ts`

---

## 🔐 Authentication & User Setup (MANDATORY)

### Initial Setup for New Installations

When setting up the system for the first time or if you encounter sign-in issues, follow these steps:

#### 1. Database Migration & Seeding
The system uses TypeORM migrations to automatically seed initial users and roles:

```bash
# Navigate to API directory
cd apps/api

# Run migrations (automatically seeds data)
npm run migration:run

#### 2. Default User Accounts
After running migrations, these test accounts are available:

| Username | Password | Role | Permissions |
|----------|----------|------|-------------|
| `admin` | `admin` | System Administrator | Full system access |
| `everest` | `everest` | Everest User | Chat & SAP OData access |

#### 3. Role & Permission System
The system includes these predefined roles:

- **admin**: `["dashboard", "users", "sapodata", "documents", "chat", "permissions"]`
- **everest**: `["chat", "sapodata"]`

#### 4. Sample Connection Data
The migration automatically creates working sample connections:

**SAP Demo System** (SAP Connection):
- **Base URL**: `https://3.238.76.92:44301` (Production SAP system)
- **Username**: `EVEREST`
- **Password**: Securely stored via password secret system
- **Cache**: Linked to AgentDB Cache for performance
- **Features**: Timeout configuration, SSL settings, custom User-Agent

**AgentDB Cache** (AgentDB Connection):
- **Database**: `SAP_ODATA_CACHE`
- **API Key**: Encrypted and securely stored
- **Token**: UUID-based access token
- **Base URL**: `https://api.agentdb.dev`
- **Purpose**: Caches SAP OData responses for improved performance

#### 5. Connection Management Features
- **Edit Functionality**: Full CRUD operations with proper form validation
- **Password Security**: Passwords stored as encrypted secrets, not in plain text
- **Cache Integration**: SAP connections can be linked to AgentDB for caching
- **Connection Testing**: Built-in connection test functionality
- **Type Safety**: Supports both SAP and AgentDB connection types
- **User-Friendly Interface**: Clear hints for password fields during editing

#### 4. Migration File Location
The seeding migration is located at:
```
apps/api/src/migrations/1727450000000-SeedInitialData.ts
```

This migration:
- Creates all necessary roles with permissions
- Creates users with proper authentication credentials
- Assigns appropriate roles to users
- Uses bcrypt for password hashing
- Handles conflicts gracefully (won't duplicate data)

#### 5. Troubleshooting Sign-in Issues

**Problem**: Cannot sign in / Authentication fails
**Solution**: 
1. Ensure database is running: `docker-compose ps`
2. Run migrations: `npm run migration:run`
3. Check if users exist in database via PgAdmin (localhost:8080)
4. Try default credentials: `admin` / `admin`

**Problem**: "User not found" errors
**Solution**: The old seed files created users without usernames/passwords. Run the new migration to fix this.

**Problem**: Database connection errors
**Solution**: Ensure PostgreSQL is running via Docker: `docker-compose up -d`

#### 6. For Other AI Installations
When deploying this system elsewhere:

1. **Copy the migration file**: Ensure `1727450000000-SeedInitialData.ts` is included
2. **Run Docker setup**: `docker-compose up -d`
3. **Run migrations**: `npm run migration:run` or `node run-migrations.js`
4. **Test authentication**: Use `admin` / `admin` to verify setup
5. **Create additional users**: Use the admin interface or API endpoints

#### 7. Production Considerations
- Change default passwords immediately in production
- Use environment variables for sensitive configuration
- Consider using proper user management systems for large deployments
- The migration system ensures consistent setup across environments

---

## 🔧 Development Rules for AI

### 1. Module Dependencies
```typescript
// ✅ CORRECT - Import system modules
import { UsersService } from '../users/users.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { EmbeddingService } from '../documents/services/embedding.service';

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

  // For AI/Vector entities
  @Column('vector', { length: 768, nullable: true })
  embedding?: number[];
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
    private readonly embeddingService: EmbeddingService, // Use AI module
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
    private readonly embeddingService: EmbeddingService, // Use AI module
  ) {}

  async create(dto: CreateExampleDto) {
    // Use system services for user operations
    const user = await this.usersService.findById(dto.userId);
    
    // Use AI services for embeddings
    if (dto.content) {
      const embedding = await this.embeddingService.generateEmbedding(dto.content);
      dto.embedding = embedding;
    }
    
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

### 2. TypeORM for Vector Operations
```typescript
// ❌ FORBIDDEN - Don't use TypeORM for chunks/documents tables
@Entity('chunks')
export class Chunk {
  @Column('text') // NEVER USE - causes text <=> vector errors
  embedding: string;
}

// ❌ FORBIDDEN - Don't use TypeORM repository for vector operations
const chunks = await this.chunkRepository
  .createQueryBuilder('chunk')
  .where('chunk.embedding <-> :embedding < :threshold') // WILL FAIL
  .getMany();

// ✅ CORRECT - Use raw SQL for vector operations
const chunks = await this.dataSource.query(`
  SELECT * FROM chunks 
  WHERE embedding <-> $1 < $2 
  ORDER BY embedding <-> $1
`, [embedding, threshold]);
```

### 3. Custom API Clients
```typescript
// ❌ FORBIDDEN - Don't create new API clients
class CustomApiClient {} // NEVER CREATE
const newFetchClient = () => {} // NEVER CREATE
const axiosClient = axios.create() // NEVER CREATE

// ✅ CORRECT - Use existing generated client
import { useGetUsers } from '@acme/api-types';
```

### 4. Custom Authentication
```typescript
// ❌ FORBIDDEN - Don't create auth logic
const isAuthenticated = (token) => { // NEVER CREATE
  // Custom auth logic
};

// ❌ FORBIDDEN - Don't create custom guards
@Injectable()
export class CustomAuthGuard {} // NEVER CREATE
```

### 5. Direct HTTP Calls
```typescript
// ❌ FORBIDDEN - Don't bypass API client
fetch('/api/endpoint') // NEVER DO
axios.get('/api/endpoint') // NEVER DO
http.request('/api/endpoint') // NEVER DO
```

### 6. Manual Infrastructure Setup
```typescript
// ❌ FORBIDDEN - Don't create manual setup scripts
// setup-database.js - FORBIDDEN (use Docker)
// setup-vector.js - FORBIDDEN (use Docker)
// install-ollama.sh - FORBIDDEN (use Docker)
```

### 7. Ad-hoc Test Files
```javascript
// ❌ FORBIDDEN - Don't create standalone test files
// test-api.js - FORBIDDEN (use Jest)
// manual-test.js - FORBIDDEN (use Jest)
// integration-test.js - FORBIDDEN (use Jest)
```

---

## 📋 AI Development Checklist

When creating new features, ALWAYS verify:

### Infrastructure Checklist
- [ ] Docker services running (`docker-compose ps`)
- [ ] PostgreSQL with pgvector available
- [ ] Ollama AI service healthy
- [ ] PgAdmin accessible for debugging

### Backend Checklist
- [ ] Uses `UsersService` for user operations
- [ ] Uses `@UseGuards(JwtAuthGuard, PermissionsGuard)` for protection
- [ ] Uses `@Permissions('action:resource')` decorator
- [ ] Follows standard entity pattern with UUID
- [ ] Has proper logging with `Logger`
- [ ] Uses dependency injection for system modules
- [ ] Includes Jest tests (unit + integration)
- [ ] Uses AI services for embeddings when needed

### Frontend Checklist
- [ ] Uses generated hooks from `@acme/api-types`
- [ ] NO direct fetch/axios/http calls
- [ ] Proper error handling with React Query
- [ ] Uses Radix UI components
- [ ] Follows responsive design patterns
- [ ] Uses translation system for all text

### AI/ML Checklist
- [ ] Uses Ollama service for embeddings
- [ ] Stores vectors in pgvector
- [ ] Implements semantic search correctly
- [ ] Uses proper vector dimensions (768)
- [ ] Handles AI service errors gracefully

### Testing Checklist
- [ ] Unit tests for services
- [ ] Integration tests for controllers
- [ ] E2E tests for complete workflows
- [ ] Test database cleanup
- [ ] Mocked external dependencies

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
- [ ] Docker services integrated properly

---

## 🎯 Key Commands for AI

```bash
# Infrastructure
docker-compose up -d              # Start all services
docker-compose ps                 # Check service status
docker-compose logs -f ollama     # View AI service logs
docker-compose down               # Stop services

# Development
pnpm dev                          # Start development servers
pnpm gen:client                   # Generate API client (MANDATORY after backend changes)
pnpm build                        # Build project

# Testing
npm test                          # Run all tests
npm run test:cov                  # Run with coverage
npm run test:e2e                  # Run e2e tests
npm run test:watch                # Watch mode

# Database
npm run migration:generate        # Generate migration
npm run migration:run             # Run migrations
```

---

## 🔒 Security Rules

1. **NEVER** bypass the auth system
2. **ALWAYS** use `@Permissions()` decorator for protected endpoints
3. **NEVER** create custom user/auth/permission logic
4. **ALWAYS** validate inputs with DTOs
5. **NEVER** use direct HTTP calls in frontend
6. **ALWAYS** use Docker for infrastructure
7. **NEVER** expose AI service directly to frontend

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

### AI Service Error Handling
```typescript
async generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch('http://nestjs-ollama:11434/api/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'nomic-embed-text', prompt: text })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama service error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.embedding;
  } catch (error) {
    this.logger.error(`Embedding generation failed: ${error.message}`);
    throw new HttpException('AI service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
  }
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
  },
  "documents": {
    "title": "Document Management",
    "upload": "Upload Document",
    "search": "Search Documents"
  },
  "chat": {
    "title": "AI Chat",
    "askQuestion": "Ask a question"
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

**CORE PRINCIPLE**: Use system modules (users, auth, permissions, documents, chat) for ALL functionality. Never recreate these systems.

**INFRASTRUCTURE RULE**: Use Docker Compose for ALL services. NEVER manual setup.

**TESTING RULE**: Use Jest test suite. NEVER create ad-hoc test scripts.

**AI/ML RULE**: Use Ollama + pgvector for embeddings and search. NEVER external AI APIs.

**COMMUNICATION RULE**: Use generated API hooks. NEVER use direct fetch/axios/http calls.

**INTERNATIONALIZATION RULE**: Use translation system for ALL text. NEVER use hardcoded strings.

**DEVELOPMENT FLOW**: 
1. Start Docker services → 2. Modify backend → 3. Run `pnpm gen:client` → 4. Use generated hooks in frontend → 5. Add translation keys → 6. Use `t('key')` for all text → 7. Write Jest tests

**FORBIDDEN ACTIONS**:
- Creating custom user/auth/permission systems
- Manual infrastructure setup (PostgreSQL, Ollama, etc.)
- Direct HTTP calls bypassing the API client
- Ad-hoc test scripts instead of Jest
- External AI services instead of Ollama
- Hardcoded text strings in UI components
- Using TypeORM for chunks/documents tables (causes vector errors)
- Creating new API clients (use existing generated client)
- Using `text` type for embedding columns (must be `vector`)
- Ignoring the established patterns

**DOCKER SERVICES**:
- PostgreSQL (nestjs-postgres:5432) - Database with pgvector
- PgAdmin (localhost:8080) - Database management
- Ollama (nestjs-ollama:11434) - AI embeddings service

**KEY FILES**:
- `docker-compose.yml` - Infrastructure definition
- `PROJECT_GUIDELINES.md` - This file (AI development rules)
- `DOCKER_SETUP.md` - Infrastructure documentation
- `jest.config.js` - Test configuration
- `packages/api-types/` - Generated API client

Follow these guidelines strictly to maintain system integrity, consistency, and leverage the full AI-powered infrastructure.
