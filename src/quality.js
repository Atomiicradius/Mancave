// Quality tiers. Phones/tablets (primary pointer is coarse) get the "low" tier.
// URL overrides for testing: ?q=low | ?q=high, and ?touch=1 to force touch controls on a desktop.
const params = new URLSearchParams(location.search);
const q = params.get('q');

export const TOUCH = params.get('touch') === '1' || matchMedia('(pointer: coarse)').matches;
const low = q ? q === 'low' : TOUCH;

export const QUALITY = {
  low,
  touch: TOUCH,
  pixelRatio: Math.min(devicePixelRatio, low ? 1.5 : 2),
  // Planar floor reflection render scale; 0 = no second scene pass (cheap glossy material instead).
  reflectionScale: low ? 0 : 0.6,
  msaaSamples: low ? 0 : 4, // post-processing target is not antialiased by the canvas, so it gets its own MSAA
  neonLights: low ? 2 : 4, // dynamic colored point lights (each one costs per-pixel lighting work)
};
