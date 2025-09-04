# NestJS + Next.js + OpenAPI (orval) Monorepo

- **Backend**: NestJS (`apps/api`) – OpenAPI via `@nestjs/swagger`
- **Frontend**: Next.js + React + TanStack Query (`apps/web`)
- **Shared**: Generierter OpenAPI-Client + Hooks (`packages/api-types`) via **orval**
- **Tooling**: pnpm + Turborepo

## Dev-Start
```bash
pnpm -F @acme/api dev     # API (Swagger: /docs)
pnpm gen:client           # OpenAPI-Client generieren/aktualisieren
pnpm -F web dev           # Web (http://localhost:3000 oder 3001)
