export type RuntimeEnvironment = "development" | "test" | "staging" | "production";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export type FeatureFlagMap = Record<string, boolean>;

export type AlertSeverityLevel = Exclude<LogLevel, "trace" | "debug">;

export interface CorsConfig {
  enabled: boolean;
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  allowCredentials: boolean;
  maxAgeSeconds: number;
}

export interface StrictTransportSecurityConfig {
  maxAgeSeconds: number;
  includeSubDomains: boolean;
  preload: boolean;
}

export interface ExpectCtConfig {
  enforce: boolean;
  maxAgeSeconds: number;
  reportUri?: string;
}

export interface SecurityHeadersConfig {
  enabled: boolean;
  contentSecurityPolicy: string;
  referrerPolicy: string;
  frameGuard: "DENY" | "SAMEORIGIN";
  permissionsPolicy: string;
  strictTransportSecurity: StrictTransportSecurityConfig;
  expectCt: ExpectCtConfig;
  crossOriginEmbedderPolicy: "require-corp" | "credentialless" | "unsafe-none";
  crossOriginOpenerPolicy: "same-origin" | "same-origin-allow-popups" | "unsafe-none";
  crossOriginResourcePolicy: "same-origin" | "same-site" | "cross-origin";
  xContentTypeOptions: "nosniff";
}

export type RateLimitStrategy = "memory" | "redis";

export interface RateLimitRouteConfig {
  points: number;
  durationSeconds: number;
  blockDurationSeconds: number;
}

export interface RateLimitConfig {
  enabled: boolean;
  keyPrefix: string;
  points: number;
  durationSeconds: number;
  blockDurationSeconds: number;
  strategy: RateLimitStrategy;
  inmemoryBlockOnConsumed?: number;
  redis?: {
    url: string;
  };
  routes: {
    auth: RateLimitRouteConfig;
  };
}

export interface ValidationConfig {
  strict: boolean;
  sanitize: boolean;
  stripUnknown: boolean;
  maxBodySizeKb: number;
}

export interface LogRotationConfig {
  maxSize: string;
  maxFiles: string;
  zippedArchive: boolean;
}

export interface RequestLoggingConfig {
  sampleRate: number;
  maxBodyLength: number;
  redactFields: string[];
}

export interface LogTransportConfig {
  directory: string;
  rotation: LogRotationConfig;
  consoleEnabled: boolean;
  request: RequestLoggingConfig;
}

export interface MetricsBasicAuthConfig {
  username: string;
  password: string;
}

export interface MetricsConfig {
  enabled: boolean;
  endpoint: string;
  prefix?: string;
  collectDefaultMetrics: boolean;
  defaultMetricsInterval: number;
  basicAuth?: MetricsBasicAuthConfig;
}

export interface DatabasePoolConfig {
  minConnections: number;
  maxConnections: number;
  idleTimeoutMs: number;
  maxLifetimeMs: number;
  connectionTimeoutMs: number;
}

export interface AlertingConfig {
  enabled: boolean;
  webhookUrl?: string;
  severityThreshold: AlertSeverityLevel;
}

export interface HealthConfig {
  uptimeGracePeriodSeconds: number;
}

export interface ResolvedEnvironment {
  nodeEnv: RuntimeEnvironment;
  appName: string;
  appPort: number;
  apiBaseUrl: string;
  frontendUrl: string;
  databaseUrl: string;
  databasePool: {
    minConnections: number;
    maxConnections: number;
  };
  queryTimeoutMs: number;
  redisUrl: string;
  storageBucket: string;
  logLevel: LogLevel;
  jwtSecret: string;
  cors: CorsConfig;
  securityHeaders: SecurityHeadersConfig;
  rateLimit: RateLimitConfig;
  validation: ValidationConfig;
  sentryDsn?: string;
  logDirectory: string;
  logMaxSize: string;
  logMaxFiles: string;
  logConsoleEnabled: boolean;
  logRequestSampleRate: number;
  logRequestMaxBodyLength: number;
  logRequestRedactFields: string[];
  metricsEnabled: boolean;
  metricsEndpoint: string;
  metricsPrefix?: string;
  metricsCollectDefault: boolean;
  metricsDefaultInterval: number;
  metricsBasicAuthUsername?: string;
  metricsBasicAuthPassword?: string;
  alertingEnabled: boolean;
  alertingWebhookUrl?: string;
  alertingSeverity: AlertSeverityLevel;
  healthUptimeGracePeriodSeconds: number;
  featureFlags: FeatureFlagMap;
  configHotReload: boolean;
  configEncryptionKey?: string;
  ci: boolean;
}

export interface ApplicationConfig {
  app: {
    name: string;
    environment: RuntimeEnvironment;
    port: number;
    apiBaseUrl: string;
    frontendUrl: string;
    logLevel: LogLevel;
  };
  database: {
    url: string;
    pool: DatabasePoolConfig;
    queryTimeoutMs: number;
  };
  cache: {
    redisUrl: string;
  };
  storage: {
    bucket: string;
  };
  security: {
    jwtSecret: string;
    cors: CorsConfig;
    headers: SecurityHeadersConfig;
    rateLimit: RateLimitConfig;
    validation: ValidationConfig;
  };
  observability: {
    sentryDsn?: string;
    logs: LogTransportConfig;
    metrics: MetricsConfig;
    alerting: AlertingConfig;
    health: HealthConfig;
  };
  featureFlags: FeatureFlagMap;
  runtime: {
    ci: boolean;
  };
}

export interface ConfigurationChange<TSnapshot> {
  snapshot: TSnapshot;
  previous?: TSnapshot;
  changedKeys: string[];
}
