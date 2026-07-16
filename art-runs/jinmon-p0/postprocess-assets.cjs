const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..", "..");
const run = path.join(root, "art-runs", "jinmon-p0");
const common = path.join(root, "public", "assets", "common");

async function ensureDirectories() {
  await fs.mkdir(common, { recursive: true });
  for (let index = 1; index <= 4; index += 1) {
    await fs.mkdir(
      path.join(root, "public", "assets", "cases", `case-${String(index).padStart(3, "0")}`),
      { recursive: true },
    );
  }
}

async function writeSilhouettes() {
  const poseNames = ["calm", "shaken", "hardened", "collapsed"];
  for (let index = 1; index <= 4; index += 1) {
    const caseId = `case-${String(index).padStart(3, "0")}`;
    const suspectId = `suspect-${String(index).padStart(3, "0")}`;
    for (let poseIndex = 0; poseIndex < poseNames.length; poseIndex += 1) {
      const input = path.join(run, "processed", caseId, `pose-${poseIndex + 1}.png`);
      const output = path.join(
        root,
        "public",
        "assets",
        "cases",
        caseId,
        `${suspectId}-pose-${poseNames[poseIndex]}.png`,
      );
      await sharp(input)
        .extend({
          top: 150,
          bottom: 150,
          left: 0,
          right: 0,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9, palette: true, colours: 256, effort: 10 })
        .toFile(output);
    }
  }
}

async function writeBackground(inputName, outputName) {
  await sharp(path.join(run, "raw", inputName))
    .resize(1920, 1080, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 9, palette: true, colours: 128, effort: 10 })
    .toFile(path.join(common, outputName));
}

async function writeLogo() {
  const trimmed = await sharp(
    path.join(run, "processed", "title-logo", "raw-sheet-clean.png"),
  )
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(1840, 540, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();
  const metadata = await sharp(trimmed).metadata();
  const left = Math.floor((2000 - metadata.width) / 2);
  const right = 2000 - metadata.width - left;
  const top = Math.floor((600 - metadata.height) / 2);
  const bottom = 600 - metadata.height - top;
  await sharp(trimmed)
    .extend({
      top,
      bottom,
      left,
      right,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, palette: true, colours: 256, effort: 10 })
    .toFile(path.join(common, "title-logo.png"));
}

async function writeIcons() {
  const source = path.join(run, "raw", "app-icon.png");
  await sharp(source)
    .resize(512, 512, { fit: "cover" })
    .png({ compressionLevel: 9, palette: true, colours: 128, effort: 10 })
    .toFile(path.join(common, "app-icon-512.png"));
  await sharp(source)
    .resize(32, 32, { fit: "cover" })
    .png({ compressionLevel: 9, palette: true, colours: 64, effort: 10 })
    .toFile(path.join(root, "public", "favicon.png"));
}

async function main() {
  await ensureDirectories();
  await writeSilhouettes();
  await writeBackground("bg-bright.png", "bg-bright.png");
  await writeBackground("bg-dim.png", "bg-dim.png");
  await writeLogo();
  await writeIcons();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
