/* eslint-disable unicorn/no-null */
import { describe, expect, it, jest } from "@jest/globals";
import type { PrismaClient } from "@prisma/client";

import { UserService } from "../user.service.js";

const createPrismaMock = () => ({
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  userPreference: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  address: {
    count: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
  },
  order: {
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  auditLog: {
    findMany: jest.fn(),
  },
});

const USER_ID = "ckuserfixture0000000000001";
const PRIMARY_ADDRESS_ID = "ckaddressfixture000000000001";
const SECONDARY_ADDRESS_ID = "ckaddressfixture000000000002";

type PrismaMock = ReturnType<typeof createPrismaMock>;
type TransactionHandler = (
  callback: (repo: unknown, tx: unknown) => Promise<unknown>,
) => Promise<unknown>;

const baseUserEntity = {
  id: USER_ID,
  email: "user@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  phone: null,
  emailVerified: true,
  emailVerifiedAt: new Date("2025-02-18T10:00:00.000Z"),
  failedLoginCount: 0,
  lockoutUntil: null,
  twoFactorEnabled: false,
  status: "ACTIVE",
  createdAt: new Date("2025-02-18T10:00:00.000Z"),
  updatedAt: new Date("2025-02-18T10:00:00.000Z"),
  roles: [],
  permissions: [],
  addresses: [],
  preferences: null,
};

describe("UserService", () => {
  const addressRepositoryMock: {
    listByUser: jest.Mock;
    findById: jest.Mock;
    softDelete: jest.Mock;
    delete: jest.Mock;
    setDefaultAddress: jest.Mock;
    withTransaction: jest.MockedFunction<TransactionHandler>;
  } = {
    listByUser: jest.fn(async () => []),
    findById: jest.fn(),
    softDelete: jest.fn(),
    delete: jest.fn(),
    setDefaultAddress: jest.fn(),
    withTransaction: jest.fn(),
  };

  const userRepositoryMock = {
    paginate: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    addressRepositoryMock.listByUser.mockResolvedValue([]);
    addressRepositoryMock.findById.mockReset();
    addressRepositoryMock.softDelete.mockReset();
    addressRepositoryMock.delete.mockReset();
    addressRepositoryMock.setDefaultAddress.mockReset();
    addressRepositoryMock.withTransaction.mockReset();
    userRepositoryMock.paginate.mockReset();
    userRepositoryMock.update.mockReset();
  });

  const buildService = (overrides: Partial<PrismaMock> = {}) => {
    const prisma: PrismaMock = { ...createPrismaMock(), ...overrides };

    addressRepositoryMock.withTransaction.mockImplementation(async (callback) =>
      callback(addressRepositoryMock, prisma as unknown as PrismaClient),
    );

    return {
      service: new UserService({
        prisma: prisma as unknown as PrismaClient,
        addressRepository: addressRepositoryMock as never,
        userRepository: userRepositoryMock as never,
      }),
      prisma,
    };
  };

  it("creates preference record when absent", async () => {
    const { service, prisma } = buildService();
    prisma.user.findUnique.mockResolvedValue(baseUserEntity);
    prisma.userPreference.findUnique.mockResolvedValue(null);
    prisma.userPreference.create.mockResolvedValue({
      id: "ckpref0000000000000000001",
      userId: USER_ID,
      language: "tr-TR",
      currency: "TRY",
      marketingOptIn: false,
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: false,
      privacySettings: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const profile = await service.getProfile(USER_ID);

    expect(prisma.userPreference.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: USER_ID }),
      }),
    );
    expect(profile.preferences.language).toBe("tr-TR");
  });

  it("sets first address as default", async () => {
    const { service, prisma } = buildService();
    prisma.address.count.mockResolvedValue(0);
    prisma.address.create.mockResolvedValue({
      id: PRIMARY_ADDRESS_ID,
      userId: USER_ID,
      label: "Home",
      fullName: "Ada Lovelace",
      phone: null,
      line1: "10 Downing St",
      line2: null,
      city: "London",
      state: null,
      postalCode: "SW1A 2AA",
      country: "GB",
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.createAddress(USER_ID, {
      label: "Home",
      fullName: "Ada Lovelace",
      line1: "10 Downing St",
      city: "London",
      postalCode: "SW1A 2AA",
      country: "GB",
    });

    expect(prisma.address.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, NOT: { id: PRIMARY_ADDRESS_ID } },
      data: { isDefault: false },
    });
    expect(prisma.address.update).toHaveBeenCalledWith({
      where: { id: PRIMARY_ADDRESS_ID },
      data: { isDefault: true },
    });
  });

  it("soft deletes addresses referenced by active orders and reassigns default", async () => {
    const { service, prisma } = buildService();
    const address = {
      id: PRIMARY_ADDRESS_ID,
      userId: USER_ID,
      isDefault: true,
    };
    addressRepositoryMock.findById.mockResolvedValue(address);
    prisma.order.count.mockResolvedValue(1);
    prisma.address.findFirst.mockResolvedValue({ id: SECONDARY_ADDRESS_ID });

    await service.deleteAddress(USER_ID, PRIMARY_ADDRESS_ID);

    expect(addressRepositoryMock.softDelete).toHaveBeenCalledWith(PRIMARY_ADDRESS_ID);
    expect(addressRepositoryMock.delete).not.toHaveBeenCalled();
    expect(addressRepositoryMock.setDefaultAddress).toHaveBeenCalledWith(
      USER_ID,
      SECONDARY_ADDRESS_ID,
    );
  });
});
