# DTO Usage Guide

This document describes how the shared DTO layer introduced in **Phase 2 – Database & Prisma ORM** should be consumed across Lumi services.

## Package Overview

- `@lumi/shared/dto` centralises cross-surface types derived from the Prisma schema.
- DTOs are defined with Zod schemas to guarantee runtime validation and static typing parity.
- Mapper utilities convert Prisma entities into serialisable DTOs without leaking internal fields (e.g. `passwordHash`).
- Type guards expose cheap runtime checks (`isUserSummaryDTO`, `isProductSummaryDTO`) for defensive programming in boundary layers.

## Primary Modules

| Module            | Purpose                                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| `base.ts`         | Foundational schemas (CUIDs, ISO timestamps, money, audit metadata).       |
| `pagination.ts`   | Cursor and page-based pagination contracts.                                |
| `filters.ts`      | Shared filters for catalogue, reviews, and orders with range validation.   |
| `user.dto.ts`     | User request/response DTOs, role & permission summaries, status guards.    |
| `catalog.dto.ts`  | Product, variant, category, and media DTOs plus product creation payloads. |
| `commerce.dto.ts` | Cart, order, payment, coupon, and address DTOs and request contracts.      |
| `prisma-types.ts` | Type-only exports & relation payload helpers generated from Prisma.        |
| `mappers.ts`      | Bidirectional conversion utilities between Prisma entities and DTOs.       |

## Working With DTOs

- **Validation**: Every schema is a Zod object; invoke `schema.parse(payload)` (or `safeParse`) to validate external inputs before invoking services.
- **Type Guards**: Use provided guards (`isUserSummaryDTO`, `isProductVariantDTO`, `isCartItemDTO`, `isOrderDetailDTO`, `isPaginationMeta`, etc.) to assert unknown values in controllers or message handlers.
- **Filters & Pagination**: Apply `isProductFilter`, `isOrderFilter`, `isReviewFilter`, `isPaginationRequest`, and `isCursorPaginationMeta` when normalising query parameters before invoking repository methods.
- **Mappers**:
  - `mapUserEntityToSummary(user)` – strips secrets, normalises names, and enforces DTO structure.
  - `mapProductToSummary(product)` – requires Prisma `include` of variants, media, and categories; throws descriptive error if relations are missing.
  - `mapCartToSummary(cart)` – computes monetary totals while formatting decimals as strings.
  - `mapOrderToSummary(order)` / `mapPaymentToSummary(payment)` – normalise timeline fields and nested amounts.
  - `mapUserCreateRequestToData(dto, passwordHash)` – prepares Prisma create input while honouring S1 (hashed password only).
- **Requests**: `userCreateRequestSchema`, `productCreateRequestSchema`, `cartUpsertItemSchema`, and others define the canonical API payloads consumed by controllers.

## OpenAPI Alignment

- OpenAPI schemas mirroring the DTOs (`Money`, `UserSummary`, `ProductSummary`, `CartSummary`, `OrderSummary`, etc.) are registered inside `apps/backend/src/config/swagger.ts`.
- Regenerate the specification via `pnpm docs:openapi:generate` whenever DTOs change to keep `docs/api/openapi.yaml` synchronised.
- Controllers should reference the shared schemas using `$ref` to guarantee parity between documentation and runtime validation.

## Testing Strategy

- Unit tests under `packages/shared/__tests__/dto.jest.spec.ts` validate schema behaviour, mapper output, and guard accuracy.
- When introducing new DTOs:
  1. Define the Zod schema in the relevant module.
  2. Extend the mapper(s) and add corresponding unit tests.
  3. Update OpenAPI definitions via the generation script.
  4. Document usage nuances in this guide if the DTO introduces non-trivial semantics.

## Adoption Checklist

1. **Import from `@lumi/shared/dto`** in both backend and frontend packages; never duplicate DTOs locally.
2. **Validate on ingress** (controllers, queue consumers) using the shared schemas.
3. **Map Prisma entities** before returning responses to ensure soft-deleted metadata and monetary formatting are respected.
4. **Leverage type guards** before logging or forwarding objects outside the trust boundary.
5. **Regenerate OpenAPI** and review docs as part of the CI pipeline (covered by `pnpm docs:openapi:check`).

Following this guide keeps DTO semantics consistent, minimises schema drift, and upholds the "single source of truth" principle mandated for the Lumi platform.
