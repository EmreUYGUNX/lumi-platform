import type { ApplicationConfig, CloudinaryRuntimeConfig } from "@lumi/types";

import { getConfig, onConfigChange } from "../../config/index.js";
import { buildEagerTransformations } from "./cloudinary.helpers.js";

export interface CloudinaryIntegrationConfig extends CloudinaryRuntimeConfig {
  eagerTransformations: ReturnType<typeof buildEagerTransformations>;
}

const buildConfig = (config: ApplicationConfig = getConfig()): CloudinaryIntegrationConfig => ({
  ...config.media.cloudinary,
  eagerTransformations: buildEagerTransformations(config.media.cloudinary.defaultDelivery),
});

let cachedConfig: CloudinaryIntegrationConfig | undefined;

export const getCloudinaryConfig = (): CloudinaryIntegrationConfig => {
  if (!cachedConfig) {
    cachedConfig = buildConfig();
  }

  return cachedConfig;
};

onConfigChange(({ snapshot }) => {
  cachedConfig = buildConfig(snapshot);
});
