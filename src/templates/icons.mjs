// Inline SVG icons (24x24, stroke based, drawn for this site). Brand icons are simplified marks for links only.
import { raw } from "./html.mjs";

const P = {
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  layers: '<path d="M12 3 2.5 8 12 13l9.5-5z"/><path d="m2.5 12.5 9.5 5 9.5-5"/><path d="m2.5 16.5 9.5 5 9.5-5"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7"/><rect x="13.5" y="3.5" width="7" height="7"/><rect x="3.5" y="13.5" width="7" height="7"/><rect x="13.5" y="13.5" width="7" height="7"/>',
  puzzle: '<path d="M9 3.5h6v3a1.8 1.8 0 1 0 3.5 0v-.5h2v6h-.5a1.8 1.8 0 1 0 0 3.5h.5v5h-6v-.5a1.8 1.8 0 1 0-3.5 0v.5h-6v-6h.5a1.8 1.8 0 1 0 0-3.5h-.5V6h5z"/>',
  sparkle: '<path d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7z"/><path d="M19 15.5c.2 1.6 1 2.4 2.5 2.5-1.5.2-2.3 1-2.5 2.5-.2-1.5-1-2.3-2.5-2.5 1.5-.1 2.3-.9 2.5-2.5z"/>',
  bag: '<path d="M5 8h14l-1 12.5H6z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.2-4 4-6 7.5-6s6.3 2 7.5 6"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5c1 1.3 2.1 2 3.5 2s2.5-.7 3.5-2"/><path d="M9 9.5v.5M15 9.5v.5"/>',
  tag: '<path d="M3.5 12.5V4.5h8l9 9-8 8z"/><circle cx="8" cy="9" r="1.2"/>',
  crosshair: '<circle cx="12" cy="12" r="7.5"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  radio: '<path d="M4.5 9.5h15v11h-15z"/><path d="M7 9.5 17 3.5"/><circle cx="15" cy="15" r="2.5"/><path d="M7.5 13.5h3M7.5 16.5h3"/>',
  route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/>',
  map: '<path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  music: '<path d="M9 18V5.5l11-2v12.5"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  access: '<circle cx="12" cy="4.5" r="1.8"/><path d="M4.5 8.5 12 10l7.5-1.5M12 10v4.5l-3.5 6.5M12 14.5l3.5 6.5"/>',
  pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  arrow: '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
  external: '<path d="M14 4.5h5.5V10M19.5 4.5 11 13"/><path d="M18 14v5.5H4.5V6H10"/>',
  menu: '<path d="M3.5 7h17M3.5 12h17M3.5 17h17"/>',
  close: '<path d="M5.5 5.5l13 13M18.5 5.5l-13 13"/>',
  chevron: '<path d="m6 9.5 6 6 6-6"/>',
  download: '<path d="M12 3.5v12M6.5 10.5l5.5 5.5 5.5-5.5M4 20.5h16"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  dot: '<circle cx="12" cy="12" r="3.5"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13"/><path d="m3.5 6 8.5 7 8.5-7"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>',
  news: '<path d="M4.5 4.5h12v15h-12z"/><path d="M16.5 8.5h3v9.5a1.5 1.5 0 0 1-3 0M7.5 8h6M7.5 11.5h6M7.5 15h4"/>',
  discord: '<path d="M8.5 5.5c-1.8.3-3.3.9-4.5 1.7C2.3 10 1.8 13 2.1 16.4c1.6 1.2 3.3 2 5 2.4l1.1-1.8M15.5 5.5c1.8.3 3.3.9 4.5 1.7 1.7 2.8 2.2 5.8 1.9 9.2-1.6 1.2-3.3 2-5 2.4l-1.1-1.8M6.5 16c3.6 1.7 7.4 1.7 11 0M7.5 7.5c3-1 6-1 9 0"/><circle cx="9" cy="12.3" r="1.3"/><circle cx="15" cy="12.3" r="1.3"/>',
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="3.5"/><path d="M10 9v6l5-3z"/>',
  tiktok: '<path d="M13.5 3.5v11.8a3.3 3.3 0 1 1-3.3-3.3"/><path d="M13.5 3.5c.4 2.6 2.2 4.4 5 4.7"/>',
  github: '<path d="M9 19.5c-4.3 1.3-4.3-2.2-6-2.6M15 21.5v-3.3c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6.1A4.8 4.8 0 0 0 18.7 6.6 4.4 4.4 0 0 0 18.6 3.3s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 3 5.4 3.3 5.4 3.3a4.4 4.4 0 0 0-.1 3.3A4.8 4.8 0 0 0 4 10c0 4.7 2.7 5.8 5.5 6.1-.6.6-.6 1.2-.5 2v3.4"/>',
  curseforge: '<path d="M3 8.5h6.5l1 3H17c1 0 2-.9 2.5-2h1.5c-.4 2.8-2.3 4.6-4.5 5L17.5 19h-9l1-4.5C6.5 14 4.4 12 3 8.5z"/>',
};

export function icon(name, { size = 20, cls = "", label = "" } = {}) {
  const body = P[name] || P.dot;
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"';
  return raw(`<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${body}</svg>`);
}

export const hasIcon = (name) => Object.prototype.hasOwnProperty.call(P, name);
