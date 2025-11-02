import type { Category, Prisma, PrismaClient } from "@prisma/client";

import { BaseRepository, type RepositoryContext } from "@/lib/repository/base.repository.js";

type CategoryRepositoryContext = RepositoryContext<
  Prisma.CategoryDelegate,
  Prisma.CategoryWhereInput,
  Prisma.CategoryOrderByWithRelationInput
>;

export interface CategoryNode extends Prisma.CategoryGetPayload<{ include: { children: true } }> {
  children: CategoryNode[];
}

const CATEGORY_DEFAULT_SORT: Prisma.CategoryOrderByWithRelationInput[] = [
  { level: "asc" },
  { displayOrder: "asc" },
  { name: "asc" },
];

export class CategoryRepository extends BaseRepository<
  Prisma.CategoryDelegate,
  Prisma.CategoryWhereInput,
  Prisma.CategoryOrderByWithRelationInput,
  Prisma.CategorySelect,
  Prisma.CategoryInclude
> {
  constructor(
    private readonly prisma: PrismaClient,
    context?: CategoryRepositoryContext,
  ) {
    super(
      context ?? {
        modelName: "Category",
        delegate: prisma.category,
        getDelegate: (client) => client.category,
        runInTransaction: (callback) => prisma.$transaction(callback),
        primaryKey: "id",
        defaultSort: CATEGORY_DEFAULT_SORT,
      },
    );
  }

  // eslint-disable-next-line class-methods-use-this -- Repository factories preserve Prisma dependency injection
  protected createWithContext(context: CategoryRepositoryContext): this {
    return new CategoryRepository(this.prisma, context) as this;
  }

  async getHierarchy(): Promise<CategoryNode[]> {
    const categories = await this.findMany({
      include: { children: true },
      orderBy: CATEGORY_DEFAULT_SORT,
    });

    const map = new Map<string, CategoryNode>();
    categories.forEach((category) => {
      map.set(category.id, { ...category, children: [] });
    });

    const roots: CategoryNode[] = [];

    categories.forEach((category) => {
      const current = map.get(category.id);
      if (!current) return;

      if (category.parentId) {
        const parent = map.get(category.parentId);
        if (parent) {
          parent.children.push(current);
          return;
        }
      }

      roots.push(current);
    });

    return roots;
  }

  async getChildren(parentId: string): Promise<Category[]> {
    return this.findMany({
      where: { parentId },
      orderBy: CATEGORY_DEFAULT_SORT,
    });
  }

  async getBreadcrumbs(categoryId: string): Promise<Category[]> {
    const category = await this.findById(categoryId);
    if (!category) {
      return [];
    }

    const segments = (category.path ?? "")
      .split(/[/:>|]/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (!segments.includes(category.id)) {
      segments.push(category.id);
    }

    return this.findMany({
      where: {
        OR: [{ id: { in: segments } }, { slug: { in: segments } }],
      },
      orderBy: CATEGORY_DEFAULT_SORT,
    });
  }

  async getTopLevel(limit = 12): Promise<Category[]> {
    return this.findMany({
      where: { level: 0 },
      orderBy: CATEGORY_DEFAULT_SORT,
      take: limit,
    });
  }

  async findBySlug(slug: string): Promise<Category | null> {
    return this.findFirst({
      where: { slug },
    }) as Promise<Category | null>;
  }

  async updateDescendantPaths(
    categoryId: string,
    parentPath: string,
    parentLevel: number,
  ): Promise<void> {
    const updateChildren = async (
      client: Prisma.TransactionClient,
      id: string,
      path: string,
      level: number,
    ): Promise<void> => {
      const children = await client.category.findMany({
        where: { parentId: id },
      });

      await Promise.all(
        children.map(async (child) => {
          const nextPath = `${path}/${child.slug}`.replaceAll(/\/+/g, "/");
          const nextLevel = level + 1;

          await client.category.update({
            where: { id: child.id },
            data: {
              path: nextPath,
              level: nextLevel,
            },
          });

          await updateChildren(client, child.id, nextPath, nextLevel);
        }),
      );
    };

    await this.withTransaction(async (_repository, client) => {
      await updateChildren(client, categoryId, parentPath, parentLevel);
    });
  }
}
