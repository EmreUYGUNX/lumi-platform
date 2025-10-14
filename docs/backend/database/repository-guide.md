# Repository Layer Guide

This document explains the Phase 2 repository architecture. Every data-access implementation must respect these patterns to remain compliant with S1–S4, P1, and Q3 requirements.

## Architecture Overview

- **BaseRepository** — shared CRUD foundation that handles pagination, sorting, soft-delete filtering, Prisma error mapping, and query logging.
- **Domain repositories** — type-safe classes per aggregate (User, Product, Order, Cart, Payment, Review, Media, Address).
- **Transaction runner** — repositories expose `withTransaction` to execute atomic operations with a scoped repository instance and Prisma `TransactionClient`.
- **Testing helpers** — `createRepositoryContext` (see `apps/backend/src/lib/__tests__/repository/base.repository.jest.spec.ts`) provides a lightweight harness for repository unit tests.

## BaseRepository Responsibilities

| Capability    | Description                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Error mapping | Converts Prisma error codes (`P2002`, `P2003`, `P2025`) into project-specific `AppError` subclasses.                               |
| Soft delete   | Automatically filters records via `deletedAt IS NULL` when a soft-delete column is configured.                                     |
| Pagination    | Provides offset-based pagination with metadata (`page`, `pageSize`, `totalItems`, `totalPages`, `hasNextPage`, `hasPreviousPage`). |
| Sorting       | Applies repository defaults when the caller omits an `orderBy` clause.                                                             |
| Logging       | Emits debug-level log entries per operation using the shared Winston logger.                                                       |
| Transactions  | Supplies a scoped repository inside `withTransaction` to avoid leaking transaction clients.                                        |

### Usage Pattern

```ts
import type { PrismaClient } from "@prisma/client";

import { BaseRepository } from "@/lib/repository/base.repository";

class ExampleRepository extends BaseRepository<
  Prisma.ExampleDelegate<undefined>,
  Prisma.ExampleWhereInput,
  Prisma.ExampleOrderByWithRelationInput
> {
  constructor(private readonly prisma: PrismaClient) {
    super({
      modelName: "Example",
      delegate: prisma.example,
      getDelegate: (client) => client.example,
      runInTransaction: (callback) => prisma.$transaction(callback),
      primaryKey: "id",
      softDeleteField: "deletedAt",
      defaultSort: [{ createdAt: "desc" }],
    });
  }

  protected createWithContext(context: (typeof this)["context"]): this {
    return new ExampleRepository(this.prisma, context) as this;
  }
}
```

## Domain Repository Capabilities

- **UserRepository** — authentication queries (email lookups, 2FA flags, lockouts).
- **ProductRepository** — search filters, soft deletion, association helpers (categories/media).
- **CategoryRepository** — hierarchy composition, breadcrumbs, top-level navigation.
- **OrderRepository** — status transitions with optimistic locking, reference lookups, customer history.
- **CartRepository** — active cart retrieval, item upsert/removal, guest-to-user merge flows.
- **PaymentRepository** — provider status updates, refund recording, order grouping.
- **ReviewRepository** — moderation pipeline, product listing with eager-loaded media.
- **MediaRepository** — idempotent asset upserts, batch retrieval.
- **AddressRepository** — default address enforcement, ordered listings.

Each repository favours eager-loading (`include`) to avoid N+1 queries and supports projection (`select`) for read-heavy callers.

## Transactions

- Always perform multi-record mutations inside `withTransaction`.
- The callback receives `(repo, client)`; use `repo` for model operations and `client` when additional delegates (e.g. `tx.cartItem`) are required.
- Do not capture transaction clients outside the callback—return plain values instead.

## Error Handling

- Unique violations ⇒ `ConflictError`.
- Missing relations ⇒ `ValidationError` with structured issues.
- Not found ⇒ `NotFoundError`.
- Unexpected failures ⇒ `InternalServerError` (non-operational) to trigger alerting.

## Testing Strategy

- Unit tests rely on mocked delegates via `createRepositoryContext` to validate query-shape expectations.
- Domain tests (`apps/backend/src/modules/__tests__/repositories.jest.spec.ts`) assert transactional orchestration without needing a live database.
- Integration tests (future) should leverage Prisma TestDatabase utilities to validate behaviour against a dedicated PostgreSQL schema.

## Extension Guidelines

1. Define a model-specific repository that extends `BaseRepository`.
2. Provide default `orderBy`, `primaryKey`, and `softDeleteField` when applicable.
3. Ensure all query helpers accept overrides for `select`/`include` to allow projection.
4. Add test coverage for every complex method (search, hierarchy building, transactions).
5. Update this guide when introducing new repository patterns.
