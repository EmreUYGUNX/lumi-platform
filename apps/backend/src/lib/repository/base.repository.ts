import { Prisma } from "@prisma/client";

import { ConflictError, InternalServerError, NotFoundError, ValidationError } from "../errors.js";
import { logger } from "../logger.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface DelegateWithMethods {
  create: (...args: any[]) => Promise<unknown>;
  findFirst: (...args: any[]) => Promise<unknown>;
  findMany: (...args: any[]) => Promise<unknown>;
  update: (...args: any[]) => Promise<unknown>;
  delete: (...args: any[]) => Promise<unknown>;
  count: (...args: any[]) => Promise<number>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

type DelegateMethodKeys = keyof DelegateWithMethods;

type DelegateMethodArgs<TDelegate extends DelegateWithMethods, TMethod extends DelegateMethodKeys> =
  Parameters<TDelegate[TMethod]> extends [] ? undefined : Parameters<TDelegate[TMethod]>[0];

type DelegateMethodResult<
  TDelegate extends DelegateWithMethods,
  TMethod extends DelegateMethodKeys,
> = Awaited<ReturnType<TDelegate[TMethod]>>;

export type TransactionRunner = <TResult>(
  callback: (client: Prisma.TransactionClient) => Promise<TResult>,
) => Promise<TResult>;

export interface RepositoryContext<
  TDelegate extends DelegateWithMethods,
  _TWhere extends Record<string, unknown>,
  TOrderBy,
> {
  modelName: string;
  delegate: TDelegate;
  getDelegate(client: Prisma.TransactionClient): TDelegate;
  runInTransaction: TransactionRunner;
  softDeleteField?: string;
  primaryKey?: string;
  defaultSort?: TOrderBy | TOrderBy[];
  logOperations?: boolean;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationOptions<
  TWhere extends Record<string, unknown>,
  TOrderBy,
  TSelect,
  TInclude,
> {
  where?: TWhere;
  orderBy?: TOrderBy | TOrderBy[];
  select?: TSelect;
  include?: TInclude;
  cursor?: Record<string, unknown>;
  page?: number;
  pageSize?: number;
  skip?: number;
  take?: number;
}

export interface CursorMeta {
  hasMore: boolean;
  next?: string;
}

export interface PaginatedResult<TItem> {
  items: TItem[];
  meta: PaginationMeta;
  cursor?: CursorMeta;
}

export interface CursorPaginatedResult<TItem> {
  items: TItem[];
  hasMore: boolean;
  nextCursor?: Record<string, unknown> | null;
}

const DEFAULT_PRIMARY_KEY = "id";
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export abstract class BaseRepository<
  TDelegate extends DelegateWithMethods,
  TWhere extends Record<string, unknown>,
  TOrderBy,
  TSelect = unknown,
  TInclude = unknown,
> {
  protected readonly context: RepositoryContext<TDelegate, TWhere, TOrderBy>;

  protected constructor(context: RepositoryContext<TDelegate, TWhere, TOrderBy>) {
    this.context = context;
  }

  protected abstract createWithContext(
    context: RepositoryContext<TDelegate, TWhere, TOrderBy>,
  ): this;

  protected get delegate(): TDelegate {
    return this.context.delegate;
  }

  protected get modelName(): string {
    return this.context.modelName;
  }

  protected get primaryKey(): string {
    return this.context.primaryKey ?? DEFAULT_PRIMARY_KEY;
  }

  protected get softDeleteField(): string | undefined {
    return this.context.softDeleteField;
  }

  protected logOperation(operation: string, metadata?: Record<string, unknown>) {
    if (this.context.logOperations === false) {
      return;
    }

    logger.debug("Repository operation executed", {
      model: this.modelName,
      operation,
      ...metadata,
    });
  }

  protected mapError(error: unknown, operation: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case "P2002": {
          const target = Array.isArray(error.meta?.target)
            ? (error.meta?.target as string[]).join(", ")
            : error.meta?.target;
          throw new ConflictError(`${this.modelName} already exists.`, {
            cause: error,
            details: target ? { target } : undefined,
          });
          break;
        }
        case "P2003": {
          const field = error.meta?.field_name ?? "relation";
          throw new ValidationError(`${this.modelName} has an invalid ${field}.`, {
            cause: error,
            details: {
              issues: [
                {
                  path: String(field),
                  message: "Related record does not exist.",
                  code: error.code,
                },
              ],
            },
          });
          break;
        }
        case "P2025": {
          throw new NotFoundError(`${this.modelName} not found.`, { cause: error });
          break;
        }
        default: {
          break;
        }
      }
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      throw new ValidationError(`${this.modelName} validation failed.`, {
        cause: error,
        details: {
          issues: [
            {
              path: this.modelName,
              message: error.message,
              code: "PRISMA_VALIDATION",
            },
          ],
        },
      });
    }

    throw new InternalServerError(`Failed to ${operation} ${this.modelName}.`, {
      cause: error,
    });
  }

  protected applySoftDelete(where?: TWhere): TWhere | undefined {
    if (!this.softDeleteField) {
      return where;
    }

    // eslint-disable-next-line unicorn/no-null -- Prisma soft delete relies on null sentinel values
    const softDeleteConstraint = { [this.softDeleteField]: null };

    if (!where || Object.keys(where).length === 0) {
      return softDeleteConstraint as TWhere;
    }

    return {
      AND: [softDeleteConstraint, where],
    } as unknown as TWhere;
  }

  protected applyDefaultSort(orderBy?: TOrderBy | TOrderBy[]): TOrderBy | TOrderBy[] | undefined {
    if (orderBy && ((Array.isArray(orderBy) && orderBy.length > 0) || !Array.isArray(orderBy))) {
      return orderBy;
    }

    return this.context.defaultSort;
  }

  protected async executeOperation<TResult>(
    operation: string,
    callback: () => Promise<TResult>,
  ): Promise<TResult> {
    try {
      this.logOperation(operation);
      return await callback();
    } catch (error) {
      return this.mapError(error, operation);
    }
  }

  async create<TArgs extends DelegateMethodArgs<TDelegate, "create">>(
    args: TArgs,
  ): Promise<DelegateMethodResult<TDelegate, "create">> {
    return this.executeOperation("create", () => this.delegate.create(args)) as Promise<
      DelegateMethodResult<TDelegate, "create">
    >;
  }

  async findById<TArgs extends DelegateMethodArgs<TDelegate, "findFirst">>(
    id: string,
    args?: Omit<TArgs, "where">,
  ): Promise<DelegateMethodResult<TDelegate, "findFirst"> | null> {
    const where = this.applySoftDelete({ [this.primaryKey]: id } as unknown as TWhere);
    const baseArgs = args
      ? ({ ...(args as Record<string, unknown>) } as Record<string, unknown>)
      : {};
    const operationArgs = {
      ...baseArgs,
      where,
    } as unknown as TArgs;

    return this.executeOperation("findById", () =>
      this.delegate.findFirst(operationArgs),
    ) as Promise<DelegateMethodResult<TDelegate, "findFirst"> | null>;
  }

  async findFirst<TArgs extends DelegateMethodArgs<TDelegate, "findFirst">>(
    args: TArgs,
  ): Promise<DelegateMethodResult<TDelegate, "findFirst"> | null> {
    const safeArgs =
      isRecord(args) && "where" in args
        ? {
            ...args,
            where: this.applySoftDelete((args as { where?: TWhere }).where),
          }
        : args;

    return this.executeOperation("findFirst", () =>
      this.delegate.findFirst(safeArgs as TArgs),
    ) as Promise<DelegateMethodResult<TDelegate, "findFirst"> | null>;
  }

  async findMany<TArgs extends DelegateMethodArgs<TDelegate, "findMany">>(
    args?: TArgs,
  ): Promise<DelegateMethodResult<TDelegate, "findMany">> {
    let safeArgs = args;

    if (safeArgs && typeof safeArgs === "object") {
      const typedArgs = safeArgs as Record<string, unknown> & {
        where?: TWhere;
        orderBy?: TOrderBy | TOrderBy[];
      };

      const nextArgs: Record<string, unknown> = { ...typedArgs };
      if (typedArgs.orderBy === undefined && this.context.defaultSort) {
        nextArgs.orderBy = this.context.defaultSort;
      }
      nextArgs.where = this.applySoftDelete(typedArgs.where);
      safeArgs = nextArgs as unknown as TArgs;
    }

    return this.executeOperation("findMany", () => this.delegate.findMany(safeArgs)) as Promise<
      DelegateMethodResult<TDelegate, "findMany">
    >;
  }

  async update<TArgs extends DelegateMethodArgs<TDelegate, "update">>(
    args: TArgs,
  ): Promise<DelegateMethodResult<TDelegate, "update">> {
    let safeArgs = args;
    if (isRecord(args) && "where" in args) {
      const nextArgs = { ...(args as Record<string, unknown>) };
      nextArgs.where = this.applySoftDelete((args as { where?: TWhere }).where);
      safeArgs = nextArgs as TArgs;
    }

    return this.executeOperation("update", () => this.delegate.update(safeArgs)) as Promise<
      DelegateMethodResult<TDelegate, "update">
    >;
  }

  async delete<TArgs extends DelegateMethodArgs<TDelegate, "delete">>(
    args: TArgs,
  ): Promise<DelegateMethodResult<TDelegate, "delete">> {
    let safeArgs = args;
    if (isRecord(args) && "where" in args) {
      const nextArgs = { ...(args as Record<string, unknown>) };
      nextArgs.where = this.applySoftDelete((args as { where?: TWhere }).where);
      safeArgs = nextArgs as TArgs;
    }

    return this.executeOperation("delete", () => this.delegate.delete(safeArgs)) as Promise<
      DelegateMethodResult<TDelegate, "delete">
    >;
  }

  async softDelete<TArgs extends DelegateMethodArgs<TDelegate, "update">>(
    id: string,
    field: string = this.softDeleteField ?? "deletedAt",
  ): Promise<DelegateMethodResult<TDelegate, "update">> {
    if (!this.softDeleteField) {
      throw new InternalServerError(`${this.modelName} repository does not support soft deletion.`);
    }

    const updateArgs = {
      where: { [this.primaryKey]: id },
      data: { [field]: new Date() },
    } as unknown as TArgs;

    return this.executeOperation("softDelete", () => this.delegate.update(updateArgs)) as Promise<
      DelegateMethodResult<TDelegate, "update">
    >;
  }

  async restore<TArgs extends DelegateMethodArgs<TDelegate, "update">>(
    id: string,
    field: string = this.softDeleteField ?? "deletedAt",
  ): Promise<DelegateMethodResult<TDelegate, "update">> {
    if (!this.softDeleteField) {
      throw new InternalServerError(
        `${this.modelName} repository does not support restoring soft-deleted records.`,
      );
    }

    const updateArgs = {
      where: { [this.primaryKey]: id },
      // eslint-disable-next-line unicorn/no-null -- Restoring a soft delete requires resetting to null for Prisma filters
      data: { [field]: null },
    } as unknown as TArgs;

    return this.executeOperation("restore", () => this.delegate.update(updateArgs)) as Promise<
      DelegateMethodResult<TDelegate, "update">
    >;
  }

  async count<TArgs extends DelegateMethodArgs<TDelegate, "count">>(args?: TArgs): Promise<number> {
    let safeArgs = args;

    if (safeArgs && typeof safeArgs === "object") {
      const argsRecord = safeArgs as Record<string, unknown> & { where?: TWhere };
      if ("where" in argsRecord) {
        safeArgs = {
          ...argsRecord,
          where: this.applySoftDelete(argsRecord.where),
        } as TArgs;
      }
    } else if (!safeArgs && this.softDeleteField) {
      safeArgs = {
        where: this.applySoftDelete({} as TWhere),
      } as TArgs;
    }

    return this.executeOperation("count", () => this.delegate.count(safeArgs));
  }

  async paginate<
    TArgs extends DelegateMethodArgs<TDelegate, "findMany">,
    TResult = DelegateMethodResult<TDelegate, "findMany"> extends readonly (infer TItem)[]
      ? TItem
      : DelegateMethodResult<TDelegate, "findMany">,
  >(
    options: PaginationOptions<TWhere, TOrderBy, TSelect, TInclude> = {},
  ): Promise<PaginatedResult<TResult>> {
    const page = Math.max(options.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const pageSize = Math.max(options.pageSize ?? DEFAULT_PAGE_SIZE, 1);
    const skip = options.skip ?? (page - 1) * pageSize;
    const take = options.take ?? pageSize;

    const where = this.applySoftDelete(options.where);
    const orderBy = this.applyDefaultSort(options.orderBy);

    const countArgs = { where } as DelegateMethodArgs<TDelegate, "count">;
    const totalItems = await this.count(countArgs);
    const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);

    const findManyArgs = {
      where,
      orderBy,
      select: options.select,
      include: options.include,
      cursor: options.cursor,
      skip,
      take,
    } as unknown as TArgs;

    const items = (await this.findMany(findManyArgs)) as unknown as TResult[];

    return {
      items,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async paginateWithCursor<
    TArgs extends DelegateMethodArgs<TDelegate, "findMany">,
    TResult = DelegateMethodResult<TDelegate, "findMany"> extends readonly (infer TItem)[]
      ? TItem
      : DelegateMethodResult<TDelegate, "findMany">,
  >(
    options: PaginationOptions<TWhere, TOrderBy, TSelect, TInclude> = {},
  ): Promise<CursorPaginatedResult<TResult>> {
    const takeValue = Math.max(options.take ?? options.pageSize ?? DEFAULT_PAGE_SIZE, 1);
    const where = this.applySoftDelete(options.where);
    const orderBy =
      this.applyDefaultSort(options.orderBy) ??
      ({
        [this.primaryKey]: "asc",
      } as unknown as TOrderBy);

    const findManyArgs: Record<string, unknown> = {
      where,
      orderBy,
      select: options.select,
      include: options.include,
      cursor: options.cursor,
      take: takeValue + 1,
    };

    if (options.cursor) {
      findManyArgs.skip = 1;
    } else if (options.skip !== undefined) {
      findManyArgs.skip = options.skip;
    }

    const records = (await this.findMany(findManyArgs as TArgs)) as unknown as TResult[];

    const hasMore = records.length > takeValue;
    const items = hasMore ? records.slice(0, takeValue) : records;

    const nextCursor = this.resolveNextCursor(items, hasMore);

    return {
      items,
      hasMore,
      nextCursor,
    };
  }

  protected resolveNextCursor<TResult>(
    items: TResult[],
    hasMore: boolean,
  ): Record<string, unknown> | undefined {
    if (!hasMore) {
      return undefined;
    }

    const lastItem = items.at(-1);
    if (!lastItem || typeof lastItem !== "object") {
      return undefined;
    }

    const { primaryKey } = this;
    if (!Reflect.has(lastItem, primaryKey)) {
      return undefined;
    }

    const cursorValue = Reflect.get(lastItem, primaryKey);
    if (cursorValue === undefined || cursorValue === null) {
      return undefined;
    }

    return { [primaryKey]: cursorValue };
  }

  async withTransaction<TResult>(
    callback: (repo: this, client: Prisma.TransactionClient) => Promise<TResult>,
  ): Promise<TResult> {
    return this.context.runInTransaction(async (client) => {
      const { getDelegate } = this.context;
      const delegate = getDelegate(client);
      const scopedRepository = this.createWithContext({
        ...this.context,
        delegate,
      });

      return callback(scopedRepository, client);
    });
  }
}
