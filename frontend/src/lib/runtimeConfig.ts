import type { AppConfig } from '@/types';

let runtimeConfig: AppConfig | null = null;

export function setRuntimeConfig(config: AppConfig) {
  runtimeConfig = config;
}

export function getRuntimeConfig(): AppConfig | null {
  return runtimeConfig;
}

export function isDemoMode(): boolean {
  return runtimeConfig?.demo_mode ?? false;
}