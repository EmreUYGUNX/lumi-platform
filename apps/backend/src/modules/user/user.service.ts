/* eslint-disable unicorn/no-null */
import type { Prisma, PrismaClient } from "@prisma/client";
import { OrderStatus } from "@prisma/client";

import { NotFoundError, ValidationError } from "@/lib/errors.js";
import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";
import type { PaginatedResult, PaginationMeta } from "@/lib/repository/base.repository.js";
import { AddressRepository } from "@/modules/address/address.repository.js";
import { UserRepository } from "@/modules/user/user.repository.js";
import {
  mapAddressEntity,
  mapUserEntityToDetail,
  mapUserEntityToSummary,
  mapUserPreferenceEntity,
} from "@lumi/shared/dto";
import type {
  AddressDTO,
  UserDetailDTO,
  UserPreferenceDTO,
  UserProfileDTO,
  UserSummaryDTO,
} from "@lumi/shared/dto";

import type {
  AdminUnlockUserInput,
  AdminUserListQuery,
  AdminUserStatusInput,
  CreateAddressInput,
  UpdateAddressInput,
  UserPreferencePatchInput,
  UserProfileUpdateInput,
} from "./user.validators.js";

const USER_NOT_FOUND = "User not found.";
const ADDRESS_NOT_FOUND = "Address not found.";
const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PAID,
  OrderStatus.FULFILLED,
  OrderStatus.SHIPPED,
];

const AUDIT_ENTITY = "users";

const buildAddressCreatePayload = (
  userId: string,
  input: CreateAddressInput,
): Prisma.AddressCreateInput => ({
  user: {
    connect: { id: userId },
  },
  label: input.label.trim(),
  fullName: input.fullName.trim(),
  phone: input.phone ?? null,
  line1: input.line1.trim(),
  line2: input.line2?.trim() ?? null,
  city: input.city.trim(),
  state: input.state?.trim() ?? null,
  postalCode: input.postalCode.trim(),
  country: input.country.trim().toUpperCase(),
  isDefault: Boolean(input.isDefault),
});

const buildAddressUpdatePayload = (input: UpdateAddressInput): Prisma.AddressUpdateInput => {
  const data: Prisma.AddressUpdateInput = {};

  if (input.label !== undefined) data.label = input.label.trim();
  if (input.fullName !== undefined) data.fullName = input.fullName.trim();
  if (input.phone !== undefined) data.phone = input.phone ?? null;
  if (input.line1 !== undefined) data.line1 = input.line1.trim();
  if (input.line2 !== undefined) data.line2 = input.line2?.trim() ?? null;
  if (input.city !== undefined) data.city = input.city.trim();
  if (input.state !== undefined) data.state = input.state?.trim() ?? null;
  if (input.postalCode !== undefined) data.postalCode = input.postalCode.trim();
  if (input.country !== undefined) data.country = input.country.trim().toUpperCase();

  return data;
};

const buildAdminUserWhereClause = (query: AdminUserListQuery): Prisma.UserWhereInput => {
  const where: Prisma.UserWhereInput = {};

  if (query.status?.length) {
    where.status = { in: query.status };
  }

  if (query.role) {
    where.roles = {
      some: {
        role: {
          name: {
            equals: query.role.trim(),
            mode: "insensitive",
          },
        },
      },
    };
  }

  if (query.search) {
    const term = query.search.trim();
    where.OR = [
      { email: { contains: term, mode: "insensitive" } },
      { firstName: { contains: term, mode: "insensitive" } },
      { lastName: { contains: term, mode: "insensitive" } },
    ];
  }

  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) {
      where.createdAt.gte = query.from;
    }
    if (query.to) {
      where.createdAt.lte = query.to;
    }
  }

  return where;
};

const escapeCsvValue = (value: string | number | boolean): string => {
  const raw = String(value ?? "");
  const needsQuoting = raw.includes(",") || raw.includes('"') || raw.includes("\n");
  if (!needsQuoting) {
    return raw;
  }

  return `"${raw.replaceAll('"', '""')}"`;
};

export const userServiceInternals = {
  buildAddressCreatePayload,
  buildAddressUpdatePayload,
  buildAdminUserWhereClause,
  escapeCsvValue,
};

export interface UserProfileResult {
  user: UserDetailDTO;
  addresses: AddressDTO[];
  preferences: UserPreferenceDTO;
}

export interface AdminUserListResult {
  items: UserSummaryDTO[];
  meta: PaginationMeta;
}

export interface AdminUserExportResult {
  filename: string;
  content: string;
}

export interface AdminUserDetailResult extends UserProfileDTO {
  metrics: {
    ordersCount: number;
    lastOrderAt: string | null;
  };
  recentAuditLogs: {
    id: string;
    action: string;
    createdAt: string;
  }[];
}

export interface UserServiceOptions {
  prisma?: PrismaClient;
  userRepository?: UserRepository;
  addressRepository?: AddressRepository;
  logger?: ReturnType<typeof createChildLogger>;
}

export class UserService {
  private readonly prisma: PrismaClient;

  private readonly userRepository: UserRepository;

  private readonly addressRepository: AddressRepository;

  private readonly logger: ReturnType<typeof createChildLogger>;

  private readonly auditEntity = AUDIT_ENTITY;

  constructor(options: UserServiceOptions = {}) {
    this.prisma = options.prisma ?? getPrismaClient();
    this.userRepository = options.userRepository ?? new UserRepository(this.prisma);
    this.addressRepository = options.addressRepository ?? new AddressRepository(this.prisma);
    this.logger = options.logger ?? createChildLogger("modules:user:service");
  }

  async getProfile(userId: string): Promise<UserProfileResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        permissions: { include: { permission: true } },
        addresses: {
          where: { deletedAt: null },
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        },
        preferences: true,
      },
    });

    if (!user) {
      throw new NotFoundError(USER_NOT_FOUND, { details: { userId } });
    }

    const preference = user.preferences ?? (await this.ensurePreferenceRecord(userId));

    return {
      user: mapUserEntityToDetail(user),
      addresses: user.addresses.map((address) => mapAddressEntity(address)),
      preferences: mapUserPreferenceEntity(preference),
    };
  }

  async updateProfile(userId: string, input: UserProfileUpdateInput): Promise<UserProfileResult> {
    if (Object.keys(input).length === 0) {
      throw new ValidationError("No profile fields provided for update.");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: input.firstName?.trim() ?? null,
        lastName: input.lastName?.trim() ?? null,
        phone: input.phone ?? null,
      },
    });

    return this.getProfile(userId);
  }

  async listAddresses(userId: string): Promise<AddressDTO[]> {
    const addresses = await this.addressRepository.listByUser(userId);
    return addresses.map((address) => mapAddressEntity(address));
  }

  async createAddress(userId: string, input: CreateAddressInput): Promise<AddressDTO> {
    const shouldDefault = await this.shouldSetDefault(userId, input.isDefault);

    const result = await this.addressRepository.withTransaction(async (_repo, tx) => {
      const address = await tx.address.create({
        data: buildAddressCreatePayload(userId, input),
      });

      if (shouldDefault || address.isDefault) {
        await tx.address.updateMany({
          where: { userId, NOT: { id: address.id } },
          data: { isDefault: false },
        });

        await tx.address.update({
          where: { id: address.id },
          data: { isDefault: true },
        });
      }

      return address;
    });

    return mapAddressEntity(result);
  }

  async updateAddress(
    userId: string,
    addressId: string,
    input: UpdateAddressInput,
  ): Promise<AddressDTO> {
    const address = await this.findUserAddress(userId, addressId);

    const updated = await this.prisma.address.update({
      where: { id: address.id },
      data: buildAddressUpdatePayload(input),
    });

    return mapAddressEntity(updated);
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const address = await this.findUserAddress(userId, addressId);

    const isUsedInActiveOrder = await this.prisma.order.count({
      where: {
        userId,
        status: { in: ACTIVE_ORDER_STATUSES },
        OR: [{ shippingAddressId: addressId }, { billingAddressId: addressId }],
      },
    });

    const deleteOperation =
      isUsedInActiveOrder > 0
        ? this.addressRepository.softDelete(address.id)
        : this.addressRepository.delete({ where: { id: address.id } });
    await deleteOperation;

    if (address.isDefault) {
      await this.assignNextDefaultAddress(userId);
    }
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<AddressDTO[]> {
    await this.findUserAddress(userId, addressId);
    await this.addressRepository.setDefaultAddress(userId, addressId);
    return this.listAddresses(userId);
  }

  async getPreferences(userId: string): Promise<UserPreferenceDTO> {
    const preference = await this.ensurePreferenceRecord(userId);
    return mapUserPreferenceEntity(preference);
  }

  async updatePreferences(
    userId: string,
    input: UserPreferencePatchInput,
  ): Promise<UserPreferenceDTO> {
    if (Object.keys(input).length === 0) {
      throw new ValidationError("No preference fields provided for update.");
    }

    await this.ensurePreferenceRecord(userId);

    const data: Prisma.UserPreferenceUpdateInput = {};

    if (input.language) {
      data.language = input.language;
    }
    if (input.currency) {
      data.currency = input.currency;
    }
    if (typeof input.marketingOptIn === "boolean") {
      data.marketingOptIn = input.marketingOptIn;
    }
    if (input.notifications) {
      if (typeof input.notifications.email === "boolean") {
        data.emailNotifications = input.notifications.email;
      }
      if (typeof input.notifications.sms === "boolean") {
        data.smsNotifications = input.notifications.sms;
      }
      if (typeof input.notifications.push === "boolean") {
        data.pushNotifications = input.notifications.push;
      }
    }
    if (input.privacy) {
      data.privacySettings = input.privacy;
    }

    const updated = await this.prisma.userPreference.update({
      where: { userId },
      data,
    });

    return mapUserPreferenceEntity(updated);
  }

  async adminListUsers(query: AdminUserListQuery): Promise<AdminUserListResult> {
    const where = buildAdminUserWhereClause(query);
    const { items, meta } = (await this.userRepository.paginate({
      page: query.page,
      pageSize: query.pageSize,
      where,
      include: {
        roles: { include: { role: true } },
        permissions: { include: { permission: true } },
      },
    })) as PaginatedResult<Parameters<typeof mapUserEntityToSummary>[0]>;

    return {
      items: items.map((item) => mapUserEntityToSummary(item)),
      meta,
    };
  }

  async exportAdminUsers(query: AdminUserListQuery): Promise<AdminUserExportResult> {
    const where = buildAdminUserWhereClause(query);
    const limit = Math.min(query.exportLimit ?? 2000, 2000);

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        roles: { include: { role: true } },
      },
    });

    const header = ["Email", "Status", "First Name", "Last Name", "Roles", "Created At"];
    const rows = users.map((user) => [
      user.email,
      user.status,
      user.firstName ?? "",
      user.lastName ?? "",
      user.roles.map((role) => role.role.name).join("|"),
      user.createdAt.toISOString(),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
      .join("\n");

    return {
      filename: `users-${new Date().toISOString().replaceAll(/[.:]/gu, "-")}.csv`,
      content: csv,
    };
  }

  async adminGetUser(userId: string): Promise<AdminUserDetailResult> {
    const profile = await this.getProfile(userId);

    const [orderMetrics, auditLogs] = await Promise.all([
      this.prisma.order.aggregate({
        _count: { _all: true },
        _max: { createdAt: true },
        where: { userId },
      }),
      this.prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          action: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      user: profile.user,
      addresses: profile.addresses,
      preferences: profile.preferences,
      metrics: {
        // eslint-disable-next-line no-underscore-dangle
        ordersCount: orderMetrics._count._all ?? 0,
        // eslint-disable-next-line no-underscore-dangle
        lastOrderAt: orderMetrics._max.createdAt?.toISOString() ?? null,
      },
      recentAuditLogs: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }

  async adminUpdateStatus(userId: string, input: AdminUserStatusInput): Promise<UserDetailDTO> {
    const updated = await this.userRepository.update({
      where: { id: userId },
      data: {
        status: input.status,
      },
      include: {
        roles: { include: { role: true } },
        permissions: { include: { permission: true } },
      },
    });

    if (!updated) {
      throw new NotFoundError(USER_NOT_FOUND, { details: { userId } });
    }

    return mapUserEntityToDetail(updated as Parameters<typeof mapUserEntityToDetail>[0]);
  }

  async adminUnlockUser(userId: string, input: AdminUnlockUserInput): Promise<UserDetailDTO> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: 0,
        lockoutUntil: null,
        status: "ACTIVE",
      },
      include: {
        roles: { include: { role: true } },
        permissions: { include: { permission: true } },
      },
    });

    this.logger.info("User account unlocked by administrator", {
      userId,
      reason: input.reason ?? "manual_unlock",
    });

    return mapUserEntityToDetail(updated as Parameters<typeof mapUserEntityToDetail>[0]);
  }

  private async shouldSetDefault(userId: string, flag?: boolean): Promise<boolean> {
    if (flag === true) {
      return true;
    }

    const count = await this.prisma.address.count({
      where: { userId, deletedAt: null },
    });

    return count === 0;
  }

  private async findUserAddress(userId: string, addressId: string) {
    const address = await this.addressRepository.findById(addressId);
    if (!address || address.userId !== userId) {
      throw new NotFoundError(ADDRESS_NOT_FOUND, { details: { userId, addressId } });
    }
    return address;
  }

  private async assignNextDefaultAddress(userId: string): Promise<void> {
    const next = await this.prisma.address.findFirst({
      where: { userId, deletedAt: null },
      orderBy: [{ createdAt: "asc" }],
    });

    if (next) {
      await this.addressRepository.setDefaultAddress(userId, next.id);
    }
  }

  private async ensurePreferenceRecord(userId: string) {
    const existing = await this.prisma.userPreference.findUnique({ where: { userId } });
    if (existing) {
      return existing;
    }

    this.logger.info("Creating default preference record", { userId });

    return this.prisma.userPreference.create({
      data: {
        userId,
        language: "tr-TR",
        currency: "TRY",
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: false,
        marketingOptIn: false,
      },
    });
  }

  getAuditEntity(): string {
    return this.auditEntity;
  }
}
