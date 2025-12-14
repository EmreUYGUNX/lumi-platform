import type {
  Address,
  Cart,
  CartItem,
  Category,
  Coupon,
  Media,
  Order,
  OrderItem,
  Payment,
  Prisma as PrismaNamespace,
  Product,
  ProductVariant,
  Review,
  User,
  UserPermission,
  UserPreference,
  UserRole,
} from "@prisma/client";

export { Prisma } from "@prisma/client";
export {
  CartStatus,
  InventoryPolicy,
  MediaProvider,
  MediaType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  ProductStatus,
  ReviewStatus,
  CouponType,
  UserStatus,
} from "@prisma/client";

export type UserEntity = Omit<User, "passwordHash" | "twoFactorSecret">;

export type UserWithRoleEntities = PrismaNamespace.UserGetPayload<{
  include: {
    roles: {
      include: {
        role: true;
      };
    };
    permissions: {
      include: {
        permission: true;
      };
    };
  };
}>;

export type UserProfileEntity = PrismaNamespace.UserGetPayload<{
  include: {
    roles: {
      include: {
        role: true;
      };
    };
    permissions: {
      include: {
        permission: true;
      };
    };
    addresses: true;
    preferences: true;
  };
}>;

export type ProductEntity = Product;

export type ProductWithRelations = PrismaNamespace.ProductGetPayload<{
  include: {
    variants: true;
    categories: {
      include: {
        category: true;
      };
    };
    productMedia: {
      include: {
        media: true;
      };
    };
  };
}>;

export type CategoryEntity = Category;

export type CartEntity = Cart;

export type CartWithItems = PrismaNamespace.CartGetPayload<{
  include: {
    items: {
      include: {
        customization: true;
        productVariant: {
          include: {
            product: true;
          };
        };
      };
    };
  };
}>;

export type OrderEntity = Order;

export type OrderWithRelations = PrismaNamespace.OrderGetPayload<{
  include: {
    user: true;
    items: {
      include: {
        product: true;
        productVariant: true;
      };
    };
    payments: true;
    shippingAddress: true;
    billingAddress: true;
  };
}>;

export type PaymentEntity = Payment;

export type ReviewEntity = Review;

export type AddressEntity = Address;

export type MediaEntity = Media;

export type ProductVariantEntity = ProductVariant;

export type ProductMediaEntity = PrismaNamespace.ProductMediaGetPayload<{
  include: {
    media: true;
  };
}>;

export type ProductCategoryEntity = PrismaNamespace.ProductCategoryGetPayload<{
  include: {
    category: true;
  };
}>;

export type CouponEntity = Coupon;

export type UserRoleEntity = UserRole;

export type UserPermissionEntity = UserPermission;
export type UserPreferenceEntity = UserPreference;

export type OrderItemEntity = OrderItem;

export type CartItemEntity = CartItem;
