import type { UploadApiErrorResponse } from "cloudinary";

export class CloudinaryIntegrationError extends Error {
  constructor(
    public readonly operation: string,
    message: string,
    public readonly statusCode?: number,
    public readonly details?: UploadApiErrorResponse["error"],
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = "CloudinaryIntegrationError";
  }
}
