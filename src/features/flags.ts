import { config } from '../config.js';

export class FeatureDisabledError extends Error {
  public readonly feature: string;
  constructor(feature: string) {
    super(`${feature} feature is currently disabled`);
    this.name = 'FeatureDisabledError';
    this.feature = feature;
  }
}

type FeatureName = 'reddit' | 'medium' | 'tts' | 'extract';

const FEATURE_MAP: Record<FeatureName, keyof typeof config> = {
  reddit: 'FEATURE_REDDIT',
  medium: 'FEATURE_MEDIUM',
  tts: 'FEATURE_TTS',
  extract: 'FEATURE_EXTRACT',
};

export function isFeatureEnabled(feature: FeatureName): boolean {
  const configKey = FEATURE_MAP[feature];
  return !!config[configKey];
}

export function requireFeature(feature: FeatureName): void {
  if (!isFeatureEnabled(feature)) {
    throw new FeatureDisabledError(feature);
  }
}
