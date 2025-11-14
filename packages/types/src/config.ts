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

export interface AuthRateLimitRouteMap {
  global: RateLimitRouteConfig;
  login: RateLimitRouteConfig;
  register: RateLimitRouteConfig;
  forgotPassword: RateLimitRouteConfig;
  resendVerification: RateLimitRouteConfig;
  refresh: RateLimitRouteConfig;
  changePassword: RateLimitRouteConfig;
}

export interface RateLimitConfig {
  enabled: boolean;
  keyPrefix: string;
  points: number;
  durationSeconds: number;
  blockDurationSeconds: number;
  strategy: RateLimitStrategy;
  inmemoryBlockOnConsumed?: number;
  ipWhitelist: string[];
  redis?: {
    url: string;
  };
  routes: {
    auth: AuthRateLimitRouteMap;
  };
}

export interface ProgressiveDelayConfig {
  baseDelayMs: number;
  stepDelayMs: number;
  maxDelayMs: number;
}

export interface AuthBruteForceConfig {
  enabled: boolean;
  windowSeconds: number;
  progressiveDelays: ProgressiveDelayConfig;
  captchaThreshold: number;
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

export interface AuthTokenConfig {
  secret: string;
  ttlSeconds: number;
}

export interface AuthCookiesConfig {
  domain?: string;
  secret: string;
}

export interface AuthSessionConfig {
  fingerprintSecret: string;
  lockoutDurationSeconds: number;
  maxLoginAttempts: number;
}

export interface EmailSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username?: string;
  password?: string;
  tls: {
    rejectUnauthorized: boolean;
  };
}

export type EmailQueueDriver = "inline" | "memory" | "bullmq";

export interface EmailQueueConfig {
  driver: EmailQueueDriver;
  concurrency: number;
}

export interface EmailRateLimitConfig {
  windowSeconds: number;
  maxPerRecipient: number;
}

export interface EmailTemplateBrandingConfig {
  productName: string;
  supportEmail: string;
  supportUrl?: string;
}

export interface EmailTemplateConfig {
  baseUrl: string;
  branding: EmailTemplateBrandingConfig;
  defaultLocale: string;
}

export interface EmailConfig {
  enabled: boolean;
  defaultSender: {
    email: string;
    name?: string;
    replyTo?: string;
  };
  signingSecret: string;
  transport: {
    driver: "smtp";
    smtp: EmailSmtpConfig;
  };
  rateLimit: EmailRateLimitConfig;
  queue: EmailQueueConfig;
  logging: {
    deliveries: boolean;
  };
  template: EmailTemplateConfig;
}

export interface CloudinaryCredentialsConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  secure: boolean;
}

export interface CloudinaryPresetConfig {
  products: string;
  banners: string;
  avatars: string;
}

export type CloudinaryFolderConfig = CloudinaryPresetConfig;

export interface CloudinaryDeliveryDefaults {
  format: string;
  fetchFormat: string;
  quality: string;
  dpr: string;
}

export interface CloudinaryWebhookConfig {
  url?: string;
  signingSecret?: string;
}

export interface CloudinaryRuntimeConfig {
  credentials: CloudinaryCredentialsConfig;
  uploadPresets: CloudinaryPresetConfig;
  folders: CloudinaryFolderConfig;
  responsiveBreakpoints: number[];
  signatureTtlSeconds: number;
  defaultDelivery: CloudinaryDeliveryDefaults;
  webhook: CloudinaryWebhookConfig;
}

export interface AuthConfig {
  jwt: {
    access: AuthTokenConfig;
    refresh: AuthTokenConfig;
  };
  cookies: AuthCookiesConfig;
  tokens: {
    emailVerification: {
      ttlSeconds: number;
    };
    passwordReset: {
      ttlSeconds: number;
    };
  };
  session: AuthSessionConfig;
  bruteForce: AuthBruteForceConfig;
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
  slowQueryThresholdMs: number;
  queryTimeoutMs: number;
  redisUrl: string;
  storageBucket: string;
  logLevel: LogLevel;
  jwtSecret: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessTtlSeconds: number;
  jwtRefreshTtlSeconds: number;
  cookieDomain?: string;
  cookieSecret: string;
  email: {
    enabled: boolean;
    defaultSender: {
      email: string;
      name?: string;
      replyTo?: string;
    };
    signingSecret: string;
    transport: {
      driver: "smtp";
      smtp: EmailSmtpConfig;
    };
    rateLimit: EmailRateLimitConfig;
    queue: EmailQueueConfig;
    logging: {
      deliveries: boolean;
    };
    template: {
      baseUrl: string;
      supportEmail: string;
      supportUrl?: string;
      defaultLocale: string;
    };
  };
  emailVerificationTtlSeconds: number;
  passwordResetTtlSeconds: number;
  sessionFingerprintSecret: string;
  lockoutDurationSeconds: number;
  maxLoginAttempts: number;
  authBruteForce: {
    enabled: boolean;
    windowSeconds: number;
    progressiveDelays: ProgressiveDelayConfig;
    captchaThreshold: number;
  };
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
  cloudinary: CloudinaryRuntimeConfig;
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
    slowQueryThresholdMs: number;
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
  auth: AuthConfig;
  observability: {
    sentryDsn?: string;
    logs: LogTransportConfig;
    metrics: MetricsConfig;
    alerting: AlertingConfig;
    health: HealthConfig;
  };
  email: EmailConfig;
  media: {
    cloudinary: CloudinaryRuntimeConfig;
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
