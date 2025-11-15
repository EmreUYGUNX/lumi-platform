import { describe, expect, it } from "@jest/globals";
import type { Prisma } from "@prisma/client";

import { userServiceInternals } from "../user.service.js";
import type { AdminUserListQuery, CreateAddressInput } from "../user.validators.js";

describe("user.service internals", () => {
  it("builds address creation payloads with trimmed values", () => {
    const input: CreateAddressInput = {
      label: "  Home ",
      fullName: "  Lumi User ",
      // eslint-disable-next-line unicorn/no-null -- Optional phone field can be null in payload.
      phone: null,
      line1: " Street 123 ",
      city: " Istanbul ",
      country: " tr ",
      postalCode: " 34000 ",
      isDefault: true,
    };

    const payload = userServiceInternals.buildAddressCreatePayload("user_1", input);
    expect(payload.label).toBe("Home");
    expect(payload.country).toBe("TR");
    expect(payload.isDefault).toBe(true);
  });

  it("builds address update payloads only with provided fields", () => {
    const payload = userServiceInternals.buildAddressUpdatePayload({
      label: "Office",
      line2: "Suite 12",
      state: undefined,
    });

    expect(payload).toEqual({
      label: "Office",
      line2: "Suite 12",
    });
  });

  it("builds admin list filters for status, role, search, and date ranges", () => {
    const query: AdminUserListQuery = {
      page: 1,
      pageSize: 25,
      format: "json",
      status: ["ACTIVE"],
      role: "manager ",
      search: " lumi ",
      from: new Date("2024-01-01"),
      to: new Date("2024-12-31"),
    };

    const where = userServiceInternals.buildAdminUserWhereClause(query);
    expect(where.status).toEqual({ in: ["ACTIVE"] });
    expect(where.roles).toMatchObject({
      some: { role: { name: { equals: "manager", mode: "insensitive" } } },
    });
    expect(where.OR).toHaveLength(3);
    const createdAtFilter = where.createdAt as Prisma.DateTimeFilter;
    expect(createdAtFilter.gte).toEqual(query.from);
    expect(createdAtFilter.lte).toEqual(query.to);
  });

  it("escapes CSV values when necessary", () => {
    expect(userServiceInternals.escapeCsvValue("plain")).toBe("plain");
    expect(userServiceInternals.escapeCsvValue("needs,quotes")).toBe('"needs,quotes"');
    expect(userServiceInternals.escapeCsvValue('quote "wrap"')).toBe('"quote ""wrap"""');
  });
});
