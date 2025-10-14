// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { describe, expect, it, jest } from "@jest/globals";
import { Prisma } from "@prisma/client";

import { ConflictError, InternalServerError } from "../../errors.js";
import {
  BaseRepository,
  type DelegateWithMethods,
  type RepositoryContext,
  type TransactionRunner,
} from "../../repository/base.repository.js";

type MockDelegate = {
  [K in keyof DelegateWithMethods]: jest.Mock<
    ReturnType<DelegateWithMethods[K]>,
    Parameters<DelegateWithMethods[K]>
  >;
} & DelegateWithMethods;

type TestWhere = Record<string, unknown>;
type TestOrderBy = Record<string, "asc" | "desc">;

const defaultRunInTransaction: TransactionRunner = async (callback) =>
  callback({} as Prisma.TransactionClient);

class TestRepository extends BaseRepository<MockDelegate, TestWhere, TestOrderBy> {
  // eslint-disable-next-line class-methods-use-this -- dynamic constructor instantiation keeps repository polymorphic
  protected createWithContext(
    context: RepositoryContext<MockDelegate, TestWhere, TestOrderBy>,
  ): this {
    const Derived = this.constructor as new (
      ctx: RepositoryContext<MockDelegate, TestWhere, TestOrderBy>,
    ) => this;
    return new Derived(context);
  }
}

const createDelegate = (): MockDelegate =>
  ({
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  }) as unknown as MockDelegate;

const createRepositoryContext = (
  modelName: string,
  delegate: MockDelegate,
  overrides: Partial<RepositoryContext<MockDelegate, TestWhere, TestOrderBy>> = {},
): RepositoryContext<MockDelegate, TestWhere, TestOrderBy> => ({
  modelName,
  delegate,
  getDelegate: overrides.getDelegate ?? (() => delegate),
  runInTransaction: overrides.runInTransaction ?? defaultRunInTransaction,
  softDeleteField: overrides.softDeleteField,
  primaryKey: overrides.primaryKey,
  defaultSort: overrides.defaultSort,
  logOperations: overrides.logOperations ?? false,
});

describe("BaseRepository", () => {
  it("maps Prisma unique constraint errors to ConflictError", async () => {
    const delegate = createDelegate();
    delegate.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed.", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["email"] },
      }),
    );

    const repo = new TestRepository(
      createRepositoryContext("TestModel", delegate, { primaryKey: "id" }),
    );

    await expect(repo.create({})).rejects.toBeInstanceOf(ConflictError);
  });

  it("adds primary key filters to findById queries", async () => {
    const delegate = createDelegate();
    delegate.findFirst.mockResolvedValue({ id: "abc" });

    const repo = new TestRepository(
      createRepositoryContext("TestModel", delegate, { primaryKey: "id" }),
    );

    await repo.findById("abc");

    expect(delegate.findFirst).toHaveBeenCalledWith({
      where: { id: "abc" },
    });
  });

  it("applies soft delete filters when configured", async () => {
    const delegate = createDelegate();
    delegate.findMany.mockResolvedValue([]);

    const repo = new TestRepository(
      createRepositoryContext("TestModel", delegate, {
        primaryKey: "id",
        softDeleteField: "deletedAt",
      }),
    );

    await repo.findMany({
      where: { status: "ACTIVE" },
    });

    const callArgs = delegate.findMany.mock.calls[0]?.[0] as {
      where?: { AND?: unknown[] };
    };
    const andFilters = Array.isArray(callArgs?.where?.AND) ? callArgs?.where?.AND : [];
    const softDeleteFilter = andFilters.at(0) as { deletedAt?: unknown } | undefined;
    const statusFilter = andFilters.at(-1) as { status?: unknown } | undefined;

    expect(softDeleteFilter?.deletedAt).toBeNull();
    expect(statusFilter?.status).toBe("ACTIVE");
  });

  it("provides pagination metadata", async () => {
    const delegate = createDelegate();
    delegate.count.mockResolvedValue(42);
    delegate.findMany.mockResolvedValue([{ id: "1" }, { id: "2" }]);

    const repo = new TestRepository(
      createRepositoryContext("TestModel", delegate, { primaryKey: "id" }),
    );

    const result = await repo.paginate({ page: 2, pageSize: 2 });

    expect(result.meta).toEqual({
      page: 2,
      pageSize: 2,
      totalItems: 42,
      totalPages: 21,
      hasNextPage: true,
      hasPreviousPage: true,
    });
    const paginateArgs = delegate.findMany.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(paginateArgs).toMatchObject({
      skip: 2,
      take: 2,
    });
  });

  it("exposes transaction helper with scoped repository", async () => {
    const delegate = createDelegate();
    const transactionDelegate = createDelegate();
    transactionDelegate.findFirst.mockResolvedValue({ id: "123" });

    const runInTransaction = jest.fn(defaultRunInTransaction);

    const repo = new TestRepository(
      createRepositoryContext("TestModel", delegate, {
        primaryKey: "id",
        getDelegate: () => transactionDelegate,
        runInTransaction,
      }),
    );

    const result = await repo.withTransaction(async (scopedRepo) => scopedRepo.findById("123"));

    expect(result).toEqual({ id: "123" });
    expect(runInTransaction).toHaveBeenCalledTimes(1);
  });

  it("throws InternalServerError when soft deleting unsupported model", async () => {
    const delegate = createDelegate();
    delegate.update.mockResolvedValue({});

    const repo = new TestRepository(
      createRepositoryContext("TestModel", delegate, { primaryKey: "id" }),
    );

    await expect(repo.softDelete("123")).rejects.toBeInstanceOf(InternalServerError);
  });

  it("supports cursor-based pagination and surfaces next cursor metadata", async () => {
    const delegate = createDelegate();
    delegate.findMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }, { id: "p3" }]);

    const repo = new TestRepository(
      createRepositoryContext("TestModel", delegate, { primaryKey: "id" }),
    );

    const result = await repo.paginateWithCursor({ take: 2 });

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
      }),
    );
    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toEqual({ id: "p2" });
  });

  it("applies cursor offsets when requesting subsequent pages", async () => {
    const delegate = createDelegate();
    delegate.findMany.mockResolvedValue([{ id: "p3" }]);

    const repo = new TestRepository(
      createRepositoryContext("TestModel", delegate, { primaryKey: "id" }),
    );

    const result = await repo.paginateWithCursor({ cursor: { id: "p2" }, take: 1 });

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "p2" },
        skip: 1,
        take: 2,
      }),
    );
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeUndefined();
  });
});
