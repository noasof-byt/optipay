import sharp from "sharp";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = resolve(__dir, "..");

// Source logo — place public/logo.png before running this script
const logoBuffer = readFileSync(resolve(root, "public/logo.png"));

const sizes = [16, 32, 48, 72, 96, 120, 128, 144, 152, 167, 180, 192, 384, 512];

// OptiPay navy blue background: #1D3480
const BG = { r: 255, g: 255, b: 255, alpha: 1 };

/**
 * Creates a square icon: navy blue (#1D3480) background + logo centered with 15% padding.
 * No text — logo symbol only.
 */
async function makeIcon(size, outPath) {
  const padding  = Math.round(size * 0.15);
  const logoSize = size - padding * 2;

  // Resize logo to fit inside padded area (preserve transparency)
  const resizedLogo = await sharp(logoBuffer)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Composite logo centered on navy background
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: resizedLogo, gravity: "center" }])
    .png()
    .toFile(outPath);

  console.log(`✓ ${size}x${size}`);
}

for (const size of sizes) {
  await makeIcon(size, resolve(root, `public/icons/icon-${size}x${size}.png`));
}

// apple-touch-icon (180×180 — iOS home screen)
await makeIcon(180, resolve(root, "public/apple-touch-icon.png"));
console.log("✓ apple-touch-icon.png");

// favicon (32×32)
await makeIcon(32, resolve(root, "public/favicon.png"));
console.log("✓ favicon.png");

console.log("\n✅ All icons generated from logo.png with navy blue (#1D3480) background");
