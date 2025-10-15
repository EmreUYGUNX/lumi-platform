# Frontend DTO Adoption Plan

This plan ensures the frontend surfaces consume the shared DTO layer introduced in Phase 2 without duplicating schemas or drifting from backend contracts.

## Objectives

- Source all API response types from `@lumi/shared/dto` to maintain parity with Prisma entities.
- Eliminate ad-hoc response interfaces inside Next.js data hooks.
- Enable typed data fetching utilities that automatically validate payloads with the shared Zod schemas.

## Execution Steps

1. **Update Module Aliases**  
   Configure the Next.js `/tsconfig.json` to reference `@lumi/shared` so DTO imports resolve without relative paths.

2. **Typed Data Hooks**
   - Create a `useProductCatalog` hook that invokes `/api/v1/catalog/products` and validates responses with `productSummarySchema` and `buildPaginatedResponseSchema`.
   - Create a `useProduct` hook that validates product detail responses via `productSummarySchema`.

3. **Component Contracts**
   - Update catalog list and product detail components to accept `ProductSummaryDTO` props.
   - Extend context providers (e.g., cart state) to consume `CartSummaryDTO` and `CartItemDTO` from the shared layer once Phase 2 repositories expose them.

4. **Error Handling**  
   Use the shared `StandardErrorResponse` shape exported by `@lumi/shared/dto` so HTTP error boundaries can render consistent messaging.

5. **Testing**
   - Leverage the shared Zod schemas inside frontend unit tests to generate fixture data (e.g., `productSummarySchema.parse(mockProduct)`).
   - Add integration tests ensuring API mocks conform to DTO contracts.

## Timeline

- **Sprint +1**: Implement hooks and update current catalog pages.
- **Sprint +2**: Refactor checkout/cart flows to adopt cart/order DTOs as soon as those endpoints ship.
- **Sprint +3**: Migrate any remaining legacy interfaces and enable lint rule that forbids in-repo duplication of DTO shapes.

Adhering to this plan keeps the frontend aligned with backend contracts, reduces maintenance overhead, and guarantees compile-time plus runtime validation courtesy of the shared schema layer.
