/**
 * @origentra/detectors — abuse detectors that feed Sentinel. Zero runtime
 * dependencies. Every detector emits evidence + confidence + alternatives +
 * limitations, never a verdict. Positive detections bridge to signed,
 * quorum-gated, appealable Sentinel signals.
 */

export * from './types.ts';
export * from './util.ts';
export * from './reuse.ts';
export * from './impersonation.ts';
export * from './report.ts';
