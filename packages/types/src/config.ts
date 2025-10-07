export type RuntimeEnvironment = "development" | "test" | "staging" | "production";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export type FeatureFlagMap = Record<string, boolean>;

export interface ResolvedEnvironment {
  nodeEnv: RuntimeEnvironment;
  appName: string;
  appPort: number;
  apiBaseUrl: string;
  frontendUrl: string;
  databaseUrl: string;
  redisUrl: string;
  storageBucket: string;
  logLevel: LogLevel;
  jwtSecret: string;
  sentryDsn?: string;
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
  };
  cache: {
    redisUrl: string;
  };
  storage: {
    bucket: string;
  };
  security: {
    jwtSecret: string;
  };
  observability: {
    sentryDsn?: string;
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
