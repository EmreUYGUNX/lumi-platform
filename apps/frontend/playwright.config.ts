/* eslint-disable import/no-extraneous-dependencies */
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "iphone-se",
      use: { ...devices["iPhone SE"] },
    },
    {
      name: "iphone-13",
      use: { ...devices["iPhone 13"] },
    },
    {
      name: "iphone-14-pro-max",
      use: { ...devices["iPhone 14 Pro Max"] },
    },
    {
      name: "ipad-mini",
      use: { ...devices["iPad Mini"] },
    },
    {
      name: "ipad-air",
      use: { ...devices["iPad Air"] },
    },
    {
      name: "ipad-pro-12-9",
      use: { ...devices["iPad Pro 12.9"] },
    },
  ],
});
