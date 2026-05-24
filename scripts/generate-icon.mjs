import sharp from "sharp";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const SIZE = 1024;
const OUT_DIR = "assets";

mkdirSync(OUT_DIR, { recursive: true });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bg" cx="30%" cy="20%" r="90%">
      <stop offset="0%" stop-color="#0f3a3a" stop-opacity="0.85"/>
      <stop offset="55%" stop-color="#0a0f1e"/>
      <stop offset="100%" stop-color="#020410"/>
    </radialGradient>

    <linearGradient id="mapTeal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2dd4bf"/>
      <stop offset="100%" stop-color="#0d9488"/>
    </linearGradient>

    <radialGradient id="pinGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="35%" stop-color="#5eead4" stop-opacity="0.85"/>
      <stop offset="70%" stop-color="#14b8a6" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#14b8a6" stop-opacity="0"/>
    </radialGradient>

    <filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="14"/>
      <feOffset dx="0" dy="8" result="offsetblur"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.6"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1024" height="1024" fill="url(#bg)"/>

  <!-- Subtle grid: NYC streets feel -->
  <g stroke="#1f2937" stroke-width="1" opacity="0.55">
    <line x1="0" y1="200" x2="1024" y2="200"/>
    <line x1="0" y1="400" x2="1024" y2="400"/>
    <line x1="0" y1="600" x2="1024" y2="600"/>
    <line x1="0" y1="800" x2="1024" y2="800"/>
    <line x1="200" y1="0" x2="200" y2="1024"/>
    <line x1="400" y1="0" x2="400" y2="1024"/>
    <line x1="600" y1="0" x2="600" y2="1024"/>
    <line x1="800" y1="0" x2="800" y2="1024"/>
  </g>

  <!-- Folded map silhouette: three panels with perspective tilt -->
  <g transform="translate(512 540) rotate(-8) scale(1)">
    <!-- Left panel: lower fold -->
    <polygon points="-320,-180 -120,-260 -120,220 -320,300" fill="#0d9488" opacity="0.95"/>
    <!-- Middle panel: raised fold -->
    <polygon points="-120,-260 120,-180 120,300 -120,220" fill="url(#mapTeal)"/>
    <!-- Right panel: lower fold -->
    <polygon points="120,-180 320,-260 320,220 120,300" fill="#0f766e" opacity="0.9"/>

    <!-- Crease shading -->
    <line x1="-120" y1="-260" x2="-120" y2="220" stroke="#042f2e" stroke-width="3" opacity="0.45"/>
    <line x1="120" y1="-180" x2="120" y2="300" stroke="#042f2e" stroke-width="3" opacity="0.45"/>

    <!-- Map content hint: faint roads on middle panel -->
    <g stroke="#5eead4" stroke-width="2" opacity="0.35" stroke-linecap="round">
      <path d="M -100 -120 L 100 -100" fill="none"/>
      <path d="M -100 -40 L 100 -20" fill="none"/>
      <path d="M -100 40 L 100 60" fill="none"/>
      <path d="M -100 140 L 100 160" fill="none"/>
      <path d="M -60 -250 L -40 280" fill="none"/>
      <path d="M 40 -240 L 60 290" fill="none"/>
    </g>
  </g>

  <!-- Pin glow halo: multiple concentric circles for a soft radiating effect -->
  <circle cx="512" cy="490" r="220" fill="url(#pinGlow)" opacity="0.6"/>
  <circle cx="512" cy="490" r="140" fill="url(#pinGlow)" opacity="0.85"/>

  <!-- Pin: bold teardrop -->
  <g filter="url(#pinShadow)">
    <path
      d="M 512 360
         C 432 360, 380 420, 380 488
         C 380 552, 420 598, 470 638
         L 512 670
         L 554 638
         C 604 598, 644 552, 644 488
         C 644 420, 592 360, 512 360 Z"
      fill="url(#mapTeal)"
      stroke="#ccfbf1"
      stroke-width="6"
    />
    <circle cx="512" cy="478" r="36" fill="#0a0f1e"/>
    <circle cx="512" cy="478" r="20" fill="#ccfbf1"/>
  </g>
</svg>`;

writeFileSync(join(OUT_DIR, "icon-source.svg"), svg);

await sharp(Buffer.from(svg))
  .resize(1024, 1024)
  .png({ compressionLevel: 9 })
  .toFile(join(OUT_DIR, "icon-only.png"));

await sharp(Buffer.from(svg))
  .resize(1024, 1024)
  .flatten({ background: "#0a0f1e" })
  .png({ compressionLevel: 9 })
  .toFile(join(OUT_DIR, "icon-only-dark.png"));

await sharp(Buffer.from(svg))
  .resize(2732, 2732, { fit: "cover", background: "#0a0f1e" })
  .extend({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    background: "#0a0f1e",
  })
  .png({ compressionLevel: 9 })
  .toFile(join(OUT_DIR, "splash.png"));

await sharp(Buffer.from(svg))
  .resize(2732, 2732, { fit: "cover", background: "#0a0f1e" })
  .png({ compressionLevel: 9 })
  .toFile(join(OUT_DIR, "splash-dark.png"));

console.log("Generated:");
console.log("  assets/icon-source.svg");
console.log("  assets/icon-only.png (1024x1024)");
console.log("  assets/icon-only-dark.png (1024x1024)");
console.log("  assets/splash.png (2732x2732)");
console.log("  assets/splash-dark.png (2732x2732)");
