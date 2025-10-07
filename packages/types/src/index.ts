export * from "./config.js";

export interface AuditTimestamps {
  createdAt: Date;
  updatedAt: Date;
}

export type Identifier = string & { readonly brand: unique symbol };
