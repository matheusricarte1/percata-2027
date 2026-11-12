import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");

const trackedFiles = execSync(
  "git ls-files --cached --others --exclude-standard src/app src/components src/theme",
  { encoding: "utf8" },
)
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => existsSync(file));

const allowColorFiles = new Set([
  "src/theme/tokens.css",
  "src/theme/materialYouTheme.ts",
]);

const chartOrAssetPatterns = [
  /recharts/i,
  /stopColor=/,
  /linearGradient/,
  /radial-gradient/,
  /canvas/i,
  /qr/i,
  /color:\s*\{\s*dark:/,
  /logo/i,
];

const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;
const arbitraryTextPattern = /\btext-\[(?:\d|clamp\()/g;
const fontFamilyPattern = /font-family:\s*["'](?!var\()[^"']+["']|fontFamily:\s*["'](?!var\()[^"']+["']/g;
const googleFontPattern = /fonts\.googleapis\.com|@import\s+url\(["']https:\/\/fonts\.googleapis\.com/g;

const colorFindings = [];
const typeFindings = [];
const fontFindings = [];

for (const file of trackedFiles) {
  const source = readFileSync(file, "utf8");
  const arbitraryTypeMatches = [...new Set(source.match(arbitraryTextPattern) || [])];
  const fontFamilyMatches = [...new Set(source.match(fontFamilyPattern) || [])];
  const googleFontMatches = [...new Set(source.match(googleFontPattern) || [])];
  const isAllowedColorFile = allowColorFiles.has(file);
  const hexMatchesOutsideAssets = [
    ...new Set(
      source
        .split(/\r?\n/)
        .filter((line) => !chartOrAssetPatterns.some((pattern) => pattern.test(line)))
        .flatMap((line) => line.match(hexPattern) || []),
    ),
  ];

  if (!isAllowedColorFile && hexMatchesOutsideAssets.length > 0) {
    colorFindings.push({
      file,
      count: hexMatchesOutsideAssets.length,
      samples: hexMatchesOutsideAssets.slice(0, 12),
    });
  }

  if (arbitraryTypeMatches.length > 0) {
    typeFindings.push({ file, count: arbitraryTypeMatches.length, samples: arbitraryTypeMatches.slice(0, 8) });
  }

  if (fontFamilyMatches.length > 0 || googleFontMatches.length > 0) {
    fontFindings.push({
      file,
      count: fontFamilyMatches.length + googleFontMatches.length,
      samples: [...fontFamilyMatches, ...googleFontMatches].slice(0, 8),
    });
  }
}

const report = {
  strict,
  budgets: {
    hardcodedColorFiles: 25,
    arbitraryTypographyFiles: 25,
    unmanagedFontFiles: 0,
  },
  totals: {
    hardcodedColorFiles: colorFindings.length,
    arbitraryTypographyFiles: typeFindings.length,
    unmanagedFontFiles: fontFindings.length,
  },
  colorFindings: colorFindings.slice(0, 25),
  typeFindings: typeFindings.slice(0, 25),
  fontFindings,
};

console.log(JSON.stringify(report, null, 2));

if (
  strict &&
  (report.totals.hardcodedColorFiles > report.budgets.hardcodedColorFiles ||
    report.totals.arbitraryTypographyFiles > report.budgets.arbitraryTypographyFiles ||
    report.totals.unmanagedFontFiles > report.budgets.unmanagedFontFiles)
) {
  process.exitCode = 1;
}
