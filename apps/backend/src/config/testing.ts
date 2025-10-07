import type { ResolvedEnvironment } from "@lumi/types";

import { loadEnvironment, resetEnvironmentCache } from "./env.js";

type EnvOverrides = Record<string, string | undefined>;

const restoreProcessEnv = (snapshot: NodeJS.ProcessEnv) => {
  Object.keys(process.env).forEach((key) => {
    if (!(key in snapshot)) {
      // eslint-disable-next-line security/detect-object-injection
      delete process.env[key];
    }
  });

  // eslint-disable-next-line security/detect-object-injection
  Object.assign(process.env, snapshot);
};

export const withTemporaryEnvironment = async <TResult>(
  overrides: EnvOverrides,
  callback: (env: ResolvedEnvironment) => Promise<TResult> | TResult,
): Promise<TResult> => {
  const snapshot = { ...process.env };

  try {
    Object.entries(overrides).forEach(([key, value]) => {
      if (value === undefined) {
        // eslint-disable-next-line security/detect-object-injection
        delete process.env[key];
      } else {
        // eslint-disable-next-line security/detect-object-injection
        process.env[key] = value;
      }
    });

    resetEnvironmentCache();
    const env = loadEnvironment({ reload: true, reason: "test" });
    return await callback(env);
  } finally {
    restoreProcessEnv(snapshot);
    resetEnvironmentCache();
  }
};
