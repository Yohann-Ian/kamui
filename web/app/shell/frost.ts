// Frost controls and background choice (DESIGN-SYSTEM.md section 6), shared by
// the server layout (which inlines bootScript so stored values apply before
// first paint) and the client store in useShell.ts.

export const FROST = {
  view: { key: "kamui.frost.view", min: 10, max: 68, fallback: 40 }, // never above 68
  strength: { key: "kamui.frost.strength", min: 0, max: 100, fallback: 35 },
  focus: { key: "kamui.frost.focus", min: 0, max: 64, fallback: 64 },
} as const;

export type FrostName = keyof typeof FROST;
export type FrostValues = Record<FrostName, number>;

export const BACKGROUND_KEY = "kamui.background";
export const BACKGROUNDS_URL = "/backgrounds/";

export const clampFrost = (name: FrostName, n: number) =>
  Math.min(FROST[name].max, Math.max(FROST[name].min, Math.round(n)));

// Strength moves the tint from 12,17,23 toward the frost cyan 160,219,242,
// at most 55% of the way, so it stays a tint rather than a wash.
export function frostVars({ view, strength, focus }: FrostValues) {
  const t = clampFrost("strength", strength) / 100;
  const mix = (from: number, to: number) => Math.round(from + (to - from) * t * 0.55);
  return {
    "--frost-view": (clampFrost("view", view) / 100).toFixed(3),
    "--frost-rgb": `${mix(12, 160)},${mix(17, 219)},${mix(23, 242)}`,
    "--frost-focus": `${clampFrost("focus", focus)}px`,
  };
}

export const backgroundVar = (file: string) => `url('${BACKGROUNDS_URL}${file}')`;

// Runs in <head> before the body paints: applies the stored Frost values and
// background. Mirrors frostVars; keep the two in step.
export function bootScript(backgrounds: string[]) {
  return `(function(){try{
var F=${JSON.stringify(FROST)},s=localStorage,r=document.documentElement.style;
function g(n){var d=F[n],v=s.getItem(d.key),x=v===null?d.fallback:+v;if(!isFinite(x))x=d.fallback;return Math.min(d.max,Math.max(d.min,Math.round(x)));}
var t=g("strength")/100;function m(a,b){return Math.round(a+(b-a)*t*0.55);}
r.setProperty("--frost-view",(g("view")/100).toFixed(3));
r.setProperty("--frost-rgb",m(12,160)+","+m(17,219)+","+m(23,242));
r.setProperty("--frost-focus",g("focus")+"px");
var B=${JSON.stringify(backgrounds)},b=s.getItem(${JSON.stringify(BACKGROUND_KEY)});
if(b&&B.indexOf(b)>=0)r.setProperty("--bg-image","url('${BACKGROUNDS_URL}"+b+"')");
}catch(e){}})();`;
}
