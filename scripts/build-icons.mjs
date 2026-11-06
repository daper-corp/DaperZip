// Regenerates every DaperZip app icon from the SVG masters in app/icons/source/.
// Outputs are committed, so normal builds need nothing; maintainers run this
// after editing a master:  node scripts/build-icons.mjs
//
// Needs ImageMagick 7 (`magick`) with an SVG delegate (librsvg) on PATH.
//
// Masters:
//   app-icon.svg        1024 grid, used for 48 px and up
//   app-icon-small.svg  32 grid, pixel-fitted for 32 px
//   app-icon-24.svg     24 grid, pixel-fitted for 24 px
//   app-icon-16.svg     16 grid, pixel-fitted for 16 px
//
// The Daper company mark (ui/assets/daper-mark.png, site/assets/daper-mark.png)
// is a separate brand asset and is not touched here.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "app", "icons", "source");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "daperzip-icons-"));

const magick = (...args) => execFileSync("magick", args, { stdio: ["ignore", "ignore", "inherit"] });

// Pick the master drawn for this pixel size.
function master(size) {
  if (size <= 16) return ["app-icon-16.svg", 16];
  if (size <= 24) return ["app-icon-24.svg", 24];
  if (size <= 32) return ["app-icon-small.svg", 32];
  return ["app-icon.svg", 1024];
}

// Render one square PNG (8-bit RGBA) and return its bytes.
const cache = new Map();
function png(size) {
  if (cache.has(size)) return cache.get(size);
  const [file, grid] = master(size);
  const out = path.join(TMP, `${size}.png`);
  // librsvg maps one SVG unit to one pixel at 96 dpi. Pixel-fitted masters are
  // rasterised 1:1 so their edges land on the pixel grid; the large master is
  // rasterised at full 1024 px and downsampled, which antialiases better than
  // rendering at a low density. The final -resize is a no-op at 1:1.
  const density = String(96 * Math.max(1, size / grid));
  const args = ["-background", "none", "-density", density, path.join(SRC, file)];
  args.push("-resize", `${size}x${size}!`, "-depth", "8", "-strip", "-define", "png:exclude-chunks=date,time", "-define", "png:color-type=6", out);
  magick(...args);
  const buf = fs.readFileSync(out);
  cache.set(size, buf);
  return buf;
}

function write(rel, buf) {
  const p = path.join(ROOT, rel);
  fs.writeFileSync(p, buf);
  console.log(`${rel}  ${buf.length} B`);
}

// ICO with PNG-compressed entries (supported since Windows Vista).
function ico(sizes) {
  const imgs = sizes.map(png);
  const head = Buffer.alloc(6 + 16 * sizes.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(sizes.length, 4);
  let offset = head.length;
  sizes.forEach((s, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(s >= 256 ? 0 : s, e);
    head.writeUInt8(s >= 256 ? 0 : s, e + 1);
    head.writeUInt8(0, e + 2);
    head.writeUInt8(0, e + 3);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(imgs[i].length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += imgs[i].length;
  });
  return Buffer.concat([head, ...imgs]);
}

// ICNS with PNG entries, same element set iconutil writes for a full iconset.
function icns() {
  const types = [
    ["icp4", 16], ["icp5", 32], ["ic11", 32], ["ic12", 64],
    ["ic07", 128], ["ic13", 256], ["ic08", 256], ["ic14", 512],
    ["ic09", 512], ["ic10", 1024],
  ];
  const parts = types.map(([type, size]) => {
    const data = png(size);
    const h = Buffer.alloc(8);
    h.write(type, 0, "ascii");
    h.writeUInt32BE(8 + data.length, 4);
    return Buffer.concat([h, data]);
  });
  const body = Buffer.concat(parts);
  const h = Buffer.alloc(8);
  h.write("icns", 0, "ascii");
  h.writeUInt32BE(8 + body.length, 4);
  return Buffer.concat([h, body]);
}

// Opaque full-bleed square for iOS, which masks the corners itself and would
// otherwise fill the transparent corners with black.
function opaque(size) {
  const src = path.join(TMP, `opaque-${size}.png`);
  const out = path.join(TMP, `opaque-${size}-out.png`);
  fs.writeFileSync(src, png(Math.round(size * 1024 / 896)));
  magick(src, "-gravity", "center", "-crop", `${size}x${size}+0+0`, "+repage",
    "-background", "#F5A524", "-flatten", "-alpha", "off", "-depth", "8", "-strip", "-define", "png:exclude-chunks=date,time", out);
  return fs.readFileSync(out);
}

// Inno Setup wizard header logo: 24-bit BMP flattened on white.
function bmp(rel, size) {
  const src = path.join(TMP, `bmp-${size}.png`);
  fs.writeFileSync(src, png(size));
  const out = path.join(ROOT, rel);
  magick(src, "-background", "#FFFFFF", "-flatten", "-alpha", "off", "-type", "TrueColor", `BMP3:${out}`);
  console.log(`${rel}  ${fs.statSync(out).size} B`);
}

try {
  // app/icons (Tauri bundle, README, drag image in app/src/main.rs)
  write("app/icons/32x32.png", png(32));
  write("app/icons/64x64.png", png(64));
  write("app/icons/128x128.png", png(128));
  write("app/icons/128x128@2x.png", png(256));
  write("app/icons/icon.png", png(512));
  write("app/icons/app-icon.png", png(1024));
  write("app/icons/icon.ico", ico([16, 24, 32, 48, 64, 256]));
  write("app/icons/icon.icns", icns());

  // website (bump ?v= in scripts/build-site.mjs when these change)
  write("site/favicon.ico", ico([16, 32, 48]));
  write("site/assets/favicon-16.png", png(16));
  write("site/assets/favicon-32.png", png(32));
  write("site/assets/apple-touch-icon.png", opaque(180));
  write("site/assets/icon-256.png", png(256));

  // installer header (installer/daperzip.iss picks one by DPI)
  bmp("installer/logo-52.bmp", 52);
  bmp("installer/logo-78.bmp", 78);
  bmp("installer/logo-104.bmp", 104);
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
