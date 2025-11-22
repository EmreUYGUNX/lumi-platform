export type Gender = "female" | "male" | "non-binary" | "prefer_not";

export interface AccountProfile {
  fullName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: Gender;
  bio?: string;
  avatarUrl?: string;
  language: string;
  timezone: string;
  currency: string;
  emailVerified?: boolean;
}

export interface AccountStats {
  orders: number;
  wishlist: number;
  reviews: number;
  completion: number;
}

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: "login" | "security" | "profile" | "order" | "system";
}

export interface AccountAddress {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

export interface SessionInfo {
  id: string;
  device: "desktop" | "mobile" | "tablet";
  browser: string;
  os: string;
  location: string;
  ip: string;
  lastActive: string;
  createdAt: string;
  trusted?: boolean;
  current?: boolean;
}

export interface NotificationSettingsModel {
  email: {
    orderUpdates: boolean;
    shipping: boolean;
    marketing: boolean;
    recommendations: boolean;
    newsletter: boolean;
  };
  push: {
    orderUpdates: boolean;
    priceDrops: boolean;
    backInStock: boolean;
  };
  sms: {
    orderUpdates: boolean;
    shipping: boolean;
  };
  frequency: "immediate" | "daily" | "weekly";
}
