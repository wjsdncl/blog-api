/**
 * OAuth Services Index
 */
import { githubOAuthService } from "./github.js";
import { googleOAuthService } from "./google.js";
import type { IOAuthService } from "./types.js";

export * from "./types.js";

// Provider lookup
const services: Record<string, IOAuthService> = {
  github: githubOAuthService,
  google: googleOAuthService,
};

export function getOAuthService(provider: string): IOAuthService | undefined {
  return services[provider.toLowerCase()];
}

export function getSupportedProviders(): string[] {
  return Object.keys(services);
}
