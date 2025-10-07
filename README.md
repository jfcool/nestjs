# NestJS + Next.js AI-Powered Monorepo

## 🎯 Project Overview

This is a **production-ready monorepo** combining **NestJS backend** with **Next.js frontend** and **AI/ML capabilities** using **Ollama** and **pgvector** for semantic search and document processing.

## 🚀 Quick Start

### Prerequisites
- **Docker & Docker Compose** (required)
- **Node.js 18+** and **pnpm** (for development)

### Complete Setup (3 Steps)

#### Step 1: Start Infrastructure
```bash
# Start all services (PostgreSQL, PgAdmin, Ollama AI)
docker-compose up -d
```

#### Step 2: Install Dependencies
```bash
# Install all dependencies
pnpm install
```

#### Step 3: Start Development Servers
```bash
# Start both backend and frontend simultaneously
pnpm dev
```

**OR start them separately:**
```bash
# Terminal 1: Start Backend (NestJS)
cd apps/api
pnpm dev

# Terminal 2: Start Frontend (Next.js)  
cd apps/web
pnpm dev
```

**The system will automatically:**
- Set up PostgreSQL with pgvector extension
- Initialize Ollama AI with embedding models
- Configure PgAdmin for database management
- Start both backend and frontend in development mode

## 🏗️ Architecture

### Core Technologies
- **Backend**: NestJS + TypeScript + PostgreSQL + pgvector + pg_trgm
- **Frontend**: Next.js 15 + React 19 + TailwindCSS + Radix UI
- **AI/ML**: Ollama (local AI) + pgvector (vector database)
- **Infrastructure**: Docker Compose
- **Testing**: Jest + Supertest
- **API**: Auto-generated TypeScript client with React Query

### System Modules
- **👥 Users**: Complete user management system
- **🔐 Auth**: JWT authentication with role-based permissions
- **📄 Documents**: AI-powered document processing and search
- **💬 Chat**: AI chat with document context (RAG)
- **🔧 Permissions**: Granular access control

## 🐳 Docker Services

| Service | Port | Purpose |
|---------|------|---------|
| **PostgreSQL** | 5432 | Database with pgvector extension |
| **PgAdmin** | 8080 | Database management UI |
| **Ollama** | 11434 | AI model server for embeddings |
| **API** | 3001 | NestJS backend |
| **Web** | 3000/3001* | Next.js frontend (*auto-adjusts if port busy) |

## 🤖 AI Features

### Document Processing
1. **Upload** documents (PDF, DOCX, TXT)
2. **Parse** content and create chunks
3. **Generate** embeddings using Ollama
4. **Store** vectors in pgvector
5. **Search** semantically similar content

### AI Chat (RAG)
- **Context-aware** responses using document knowledge
- **Semantic search** for relevant information
- **Local AI** processing (no external APIs)

## 📋 Development Guidelines

> **⚠️ IMPORTANT**: This project has strict development guidelines to ensure consistency and leverage the full AI infrastructure.

### Before Starting Development
1. **Read** `PROJECT_GUIDELINES.md` - Contains all mandatory patterns
2. **Use** existing system modules (never recreate user/auth/permission systems)
3. **Follow** Docker-first approach (never manual setup)
4. **Write** Jest tests (never ad-hoc test scripts)

### Key Rules
- ✅ **Use Docker Compose** for all infrastructure
- ✅ **Use system modules** (Users, Auth, Documents, Chat)
- ✅ **Use generated API hooks** (never direct fetch calls)
- ✅ **Use Jest tests** (never standalone test scripts)
- ✅ **Use Ollama AI** (never external AI APIs)
- ✅ **Use translations** (never hardcoded strings)

## 🔧 Development Commands

```bash
# Infrastructure
docker-compose up -d              # Start all services
docker-compose ps                 # Check service status
docker-compose logs -f ollama     # View AI service logs
docker-compose down               # Stop services

# Development
pnpm dev                          # Start development servers
pnpm gen:client                   # Generate API client (run after backend changes)
pnpm build                        # Build project

# Testing
pnpm test                         # Run all tests
pnpm run test:cov                 # Run with coverage
pnpm run test:e2e                 # Run e2e tests

# Database (from apps/api directory)
cd apps/api
pnpm run db:generate              # Generate migration
pnpm run db:migrate               # Run migrations
pnpm run db:studio                # Open Drizzle Studio
```

## 📁 Project Structure

```
nestjs/
├── apps/
│   ├── api/                    # NestJS Backend
│   │   ├── src/
│   │   │   ├── users/         # User management system
│   │   │   ├── auth/          # Authentication & authorization
│   │   │   ├── documents/     # AI document processing
│   │   │   ├── chat/          # AI chat with RAG
│   │   │   └── migrations/    # Database migrations
│   │   └── test/              # Jest test suite
│   └── web/                   # Next.js Frontend
├── packages/
│   └── api-types/             # Generated API client
├── docker-compose.yml         # Infrastructure definition
├── PROJECT_GUIDELINES.md      # Development rules (READ FIRST!)
└── .cline_rules              # AI assistant rules
```

## 🧪 Testing

The project includes a comprehensive Jest test suite:

- **Unit Tests**: Service and utility testing
- **Integration Tests**: Controller and database testing
- **E2E Tests**: Complete workflow testing
- **Automatic Cleanup**: Test database isolation

```bash
# Run specific test types
pnpm run test:unit             # Unit tests only
pnpm run test:integration      # Integration tests only
pnpm run test:e2e              # End-to-end tests only
```

## 🌐 Internationalization

Full i18n support with:
- **Languages**: English (default), German
- **Dynamic switching**: Language switcher in navigation
- **Type-safe**: All translation keys are typed
- **Mandatory**: All UI text must use translations

## 🔒 Security

- **JWT Authentication** with refresh tokens
- **Role-based permissions** with granular control
- **Input validation** with DTOs
- **SQL injection protection** with Drizzle ORM
- **CORS configuration** for production

## 📊 Database

### PostgreSQL with pgvector & pg_trgm
- **Vector storage** for AI embeddings (768 dimensions)
- **Semantic search** with cosine similarity
- **Fuzzy text search** with pg_trgm extension
- **Automatic migrations** with Drizzle ORM
- **PgAdmin UI** for database management
- **Drizzle Studio** for visual database management

### Key Entities
- **Users**: UUID-based user management
- **Documents**: File metadata and processing status
- **Chunks**: Text segments with embeddings
- **Conversations**: AI chat history
- **Messages**: Chat messages with context

## 🚀 Deployment

### Local Development
```bash
docker-compose up -d
pnpm dev
```

### Production Build
```bash
docker-compose up -d
pnpm build
pnpm start
```

## 📖 Documentation

- **`PROJECT_GUIDELINES.md`** - Complete development rules and patterns
- **`DOCKER_SETUP.md`** - Infrastructure setup and troubleshooting
- **`DATABASE_SETUP.md`** - Database schema and migrations
- **`LOCAL_DEVELOPMENT_GUIDE.md`** - SAP OData integration guide
- **`API_DOCUMENTATION.md`** - API endpoints and usage

## 🤝 Contributing

1. **Read** `PROJECT_GUIDELINES.md` first
2. **Follow** established patterns and system modules
3. **Use** Docker for all infrastructure
4. **Write** Jest tests for all new features
5. **Generate** API client after backend changes: `pnpm gen:client`

## 🆘 Troubleshooting

### Common Issues

**Ollama not responding?**
```bash
docker-compose logs -f ollama
# Wait for model download to complete (first run takes 3-5 minutes)
```

**Database connection issues?**
```bash
docker-compose ps
# Ensure nestjs-postgres is running and healthy

# Check database extensions
docker exec nestjs-postgres psql -U postgres -d nestjs_app -c "SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'pg_trgm');"
```

**Document search not working?**
```bash
# Ensure pg_trgm extension is installed
docker exec nestjs-postgres psql -U postgres -d nestjs_app -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"

# Reindex documents if embeddings are NULL
cd apps/api
pnpm exec tsx reindex-now.ts
```

**API client out of sync?**
```bash
pnpm gen:client
# Run after any backend API changes
```

## 📝 License

This project is licensed under the MIT License.

---

## 🎯 For AI Assistants

This project has **strict development guidelines** in `PROJECT_GUIDELINES.md` and `.cline_rules`. 

**MANDATORY**: Always read these files before starting any task to understand the established architecture and forbidden patterns.

**Key principle**: Use existing system modules instead of creating custom implementations.
