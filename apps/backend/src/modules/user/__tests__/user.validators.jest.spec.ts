import { describe, expect, it } from "@jest/globals";

import { userPreferenceUpdateSchema } from "@lumi/shared/dto";

import {
  adminUserListQuerySchema,
  createAddressSchema,
  updateAddressSchema,
  updatePreferencesSchema,
  updateProfileSchema,
  userPreferencePatchSchema,
  userProfileUpdateSchema,
} from "../user.validators.js";

describe("user.validators", () => {
  it("enforces at least one field for profile update", () => {
    expect(() => userProfileUpdateSchema.parse({})).toThrow(/At least one field/iu);

    const result = userProfileUpdateSchema.parse({ firstName: "Ada" });
    expect(result.firstName).toBe("Ada");
    expect(updateProfileSchema.parse({ firstName: "Ada" })).toEqual(result);
  });

  it("validates address creation payload", () => {
    const payload = {
      label: "Home",
      fullName: "Ada Lovelace",
      line1: "10 Downing St",
      city: "London",
      postalCode: "SW1A 2AA",
      country: "GB",
    };

    expect(() => createAddressSchema.parse(payload)).not.toThrow();
    expect(() => createAddressSchema.parse({ ...payload, country: "gbr" })).toThrow(
      /Country codes/iu,
    );
  });

  it("rejects invalid date ranges for admin listing", () => {
    expect(() =>
      adminUserListQuerySchema.parse({
        page: 1,
        pageSize: 20,
        from: "2025-02-20",
        to: "2025-02-19",
      }),
    ).toThrow(/from.*cannot be after/iu);
  });

  it("allows partial address updates", () => {
    expect(() => updateAddressSchema.parse({ postalCode: "90210" })).not.toThrow();
  });

  it("merges shared preference schema defaults", () => {
    const payload = {
      notifications: { email: false },
      marketingOptIn: true,
    };

    const parsed = userPreferencePatchSchema.parse(payload);
    expect(parsed.notifications?.email).toBe(false);
    expect(parsed.marketingOptIn).toBe(true);
    expect(() => userPreferenceUpdateSchema.parse(payload)).not.toThrow();
    expect(updatePreferencesSchema.parse(payload)).toEqual(parsed);
  });
});
