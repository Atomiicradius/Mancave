// Quality tiers. Phones/tablets (primary pointer is coarse) default to "low", everything else to "high".
// The start screen has a High/Low toggle (remembered in localStorage). URL overrides for testing win over it:
//   ?q=low | ?q=high, and ?touch=1 to force touch controls on a desktop.
const params = new URLSearchParams(location.search);

function stored() {
  try {
    return localStorage.getItem('garage.quality');
  } catch {
    return null; // storage blocked (private window etc.): fall back to auto
  }
}

export const TOUCH = params.get('touch') === '1' || matchMedia('(pointer: coarse)').matches;
const choice = params.get('q') ?? stored();
const low = choice ? choice === 'low' : TOUCH;

export const QUALITY = {
  low,
  touch: TOUCH,
  pixelRatio: Math.min(devicePixelRatio, low ? 1.5 : 2),
  // Planar reflections (floor + car platform): size relative to the canvas; 0 = no extra scene pass (cheap glossy material).
  reflectionScale: low ? 0 : 0.75,
  msaaSamples: low ? 0 : 4, // post-processing target is not antialiased by the canvas, so it gets its own MSAA
  neonLights: low ? 2 : 4, // dynamic colored point lights (each one costs per-pixel lighting work)
  shafts: !low, // faint light shafts under the hanging tube lights
  fog: true, // very light exponential fog (cheap, so on for both tiers)
};

// Reflection render-target size for a given scale: follows the canvas so reflections are as sharp as the screen, within limits.
export function reflectionSize(scale) {
  const w = Math.round(Math.min(1600, Math.max(256, innerWidth * QUALITY.pixelRatio * scale)));
  const h = Math.round(Math.min(1200, Math.max(192, innerHeight * QUALITY.pixelRatio * scale)));
  return [w, h];
}

export function setQuality(tier) {
  try {
    localStorage.setItem('garage.quality', tier);
  } catch {
    /* ignore */
  }
  const url = new URL(location.href);
  url.searchParams.delete('q'); // a ?q= override would win over the stored choice
  location.href = url.toString();
}
