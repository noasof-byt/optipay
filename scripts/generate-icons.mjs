import sharp from "sharp";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = resolve(__dir, "..");

const svgBuffer = readFileSync(resolve(root, "public/logo.svg"));

const sizes = [16, 32, 48, 72, 96, 120, 128, 144, 152, 167, 180, 192, 384, 512];

for (const size of sizes) {
  const out = resolve(root, `public/icons/icon-${size}x${size}.png`);
  await sharp(svgBuffer, { density: 300 })
    .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(out);
  console.log(`✓ ${size}x${size}`);
}

// Also write apple-touch-icon and favicon.ico (32px png used as ico)
await sharp(svgBuffer, { density: 300 })
  .resize(180, 180, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
  .png()
  .toFile(resolve(root, "public/apple-touch-icon.png"));
console.log("✓ apple-touch-icon.png");

await sharp(svgBuffer, { density: 300 })
  .resize(32, 32, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
  .png()
  .toFile(resolve(root, "public/favicon.png"));
console.log("✓ favicon.png");

console.log("\nAll icons generated in public/icons/");
