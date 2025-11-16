export interface CloudinaryDerivedAsset {
  id?: string;
  url?: string;
  secure_url?: string;
  bytes?: number;
  format?: string;
  transformation?: string;
  width?: number;
  height?: number;
}

export interface CloudinaryModerationPayload {
  status?: string;
  kind?: string;
  description?: string;
  response?: Record<string, unknown>;
}

export interface CloudinaryWebhookPayload {
  notification_id?: string;
  request_id?: string;
  notification_type?: string;
  asset_id?: string;
  public_id?: string;
  signature?: string;
  secure_url?: string;
  url?: string;
  version?: number;
  type?: string;
  resource_type?: string;
  folder?: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
  etag?: string;
  original_filename?: string;
  tags?: string[];
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  derived?: CloudinaryDerivedAsset[];
  moderation_status?: string;
  moderation_response?: Record<string, unknown>;
  access_control?: unknown;
  [key: string]: unknown;
}

export interface CloudinaryWebhookEvent {
  id: string;
  type: string;
  timestamp: number;
  payload: CloudinaryWebhookPayload;
  signature: string;
  rawBodyChecksum: string;
  attempt: number;
}

export interface CloudinaryWebhookQueueResult {
  jobId: string;
}
