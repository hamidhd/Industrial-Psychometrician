import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function tryRun(cmd) {
  try {
    return run(cmd);
  } catch {
    return '';
  }
}

function parseSemver(v) {
  const m = String(v).replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return [1, 0, 0];
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function compareSemver(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function formatSemver([maj, min, pat]) {
  return `${maj}.${min}.${pat}`;
}

function tagExists(tag) {
  return Boolean(tryRun(`git rev-parse -q --verify "refs/tags/${tag}"`));
}

const IGNORED_DIFF_PREFIXES = ['src-tauri/icons/', 'dist/', 'node_modules/'];
const IGNORED_DIFF_FILES = new Set([
  'package-lock.json',
  'bun.lock',
  'bun.lockb',
  'yarn.lock',
  'pnpm-lock.yaml',
  'src-tauri/Cargo.lock',
]);

function isCountedFile(filePath) {
  if (!filePath) return false;
  if (IGNORED_DIFF_FILES.has(filePath)) return false;
  return !IGNORED_DIFF_PREFIXES.some((p) => filePath.startsWith(p));
}

function main() {
  const pkgPath = path.resolve('package.json');
  const tauriConfPath = path.resolve('src-tauri/tauri.conf.json');
  const cargoTomlPath = path.resolve('src-tauri/Cargo.toml');

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const latestTag =
    tryRun('git tag --list "v[0-9]*.[0-9]*.[0-9]*" --sort=-v:refname')
      .split(/\r?\n/)
      .filter(Boolean)[0] || '';

  const commitCount = Number(tryRun('git rev-list --count HEAD') || '1');
  const pkgVersion =
    pkg.version && pkg.version !== '0.0.0' ? parseSemver(pkg.version) : [1, 0, 0];
  const tagVersion = latestTag ? parseSemver(latestTag) : null;
  const manualOverride = Boolean(tagVersion && compareSemver(pkgVersion, tagVersion) > 0);
  const baseVersion = tagVersion && !manualOverride ? tagVersion : pkgVersion;

  let bumpType = manualOverride ? 'manual' : 'initial';
  let reason = manualOverride
    ? `نسخه دستی ثبت‌شده در package.json (${formatSemver(pkgVersion)})`
    : 'انتشار اولیه نسخه دسکتاپ';
  let filesChanged = 0;
  let addedFiles = 0;
  let linesChanged = 0;
  let nextVersion = [...baseVersion];
  let commitLines = [];

  const baseRef = latestTag || (commitCount > 1 ? 'HEAD~1' : '');

  if (baseRef && !manualOverride) {
    const numstat = tryRun(`git diff --numstat ${baseRef}..HEAD`);
    for (const line of numstat.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const [insRaw, delRaw, file] = line.split('\t');
      if (!isCountedFile(file)) continue;
      const ins = insRaw === '-' ? 0 : Number(insRaw) || 0;
      const del = delRaw === '-' ? 0 : Number(delRaw) || 0;
      linesChanged += ins + del;
    }

    const nameStatus = tryRun(`git diff --name-status ${baseRef}..HEAD`);
    for (const line of nameStatus.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      const status = parts[0] || '';
      const file = parts[parts.length - 1] || '';
      if (!isCountedFile(file)) continue;
      filesChanged += 1;
      if (status.startsWith('A')) addedFiles += 1;
    }

    const commitMsgs = tryRun(`git log ${baseRef}..HEAD --format=%B`);
    commitLines = tryRun(`git log ${baseRef}..HEAD --no-merges --format="- %s (%h)"`)
      .split(/\r?\n/)
      .filter((l) => l && !l.includes('[skip ci]'));

    const hasMajorMarker = /(BREAKING CHANGE|^[a-z]+!:|\[\s*major\s*\])/im.test(commitMsgs);
    const hasMinorMarker = /(^feat(\(.+\))?:|\[\s*minor\s*\])/im.test(commitMsgs);

    if (hasMajorMarker || linesChanged >= 800 || filesChanged >= 15) {
      bumpType = 'major';
      nextVersion = [baseVersion[0] + 1, 0, 0];
      reason = hasMajorMarker
        ? 'تغییر اساسی (BREAKING CHANGE / major)'
        : `تغییرات گسترده (${filesChanged} فایل، ${linesChanged} خط تغییر)`;
    } else if (hasMinorMarker || addedFiles >= 2 || linesChanged >= 120 || filesChanged >= 4) {
      bumpType = 'minor';
      nextVersion = [baseVersion[0], baseVersion[1] + 1, 0];
      reason = hasMinorMarker
        ? 'افزودن قابلیت جدید (feat / minor)'
        : `تغییرات متوسط یا فایل‌های جدید (${filesChanged} فایل، ${linesChanged} خط تغییر)`;
    } else {
      bumpType = 'patch';
      nextVersion = [baseVersion[0], baseVersion[1], baseVersion[2] + 1];
      reason = `اصلاح یا تغییر جزئی (${filesChanged} فایل، ${linesChanged} خط تغییر)`;
    }
  } else {
    commitLines = tryRun('git log -n 5 --no-merges --format="- %s (%h)"')
      .split(/\r?\n/)
      .filter(Boolean);
    if (tagExists(`v${formatSemver(nextVersion)}`)) {
      bumpType = 'patch';
      nextVersion = [baseVersion[0], baseVersion[1], baseVersion[2] + 1];
    }
  }

  while (tagExists(`v${formatSemver(nextVersion)}`)) {
    nextVersion[2] += 1;
  }

  const versionStr = formatSemver(nextVersion);
  const tagStr = `v${versionStr}`;

  // 1. Update package.json
  pkg.version = versionStr;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  // 2. Update src-tauri/tauri.conf.json
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = versionStr;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8');

  // 3. Update src-tauri/Cargo.toml ([package] version)
  const cargoRaw = fs.readFileSync(cargoTomlPath, 'utf8');
  const cargoUpdated = cargoRaw.replace(
    /^version\s*=\s*"[^"]*"/m,
    `version = "${versionStr}"`
  );
  fs.writeFileSync(cargoTomlPath, cargoUpdated, 'utf8');

  // 4. Write release notes markdown
  const releaseNotes = [
    `نسخه‌ی دسکتاپ ویندوز و اندروید **روان‌سنج صنعتی** (${tagStr})`,
    '',
    `- **نوع ارتقای خودکار نسخه:** \`${bumpType}\``,
    `- **علت انتخاب نسخه:** ${reason}`,
    `- **حجم تغییرات:** ${filesChanged} فایل · ${linesChanged} خط`,
    '',
    ...(commitLines.length > 0
      ? ['### فهرست تغییرات', ...commitLines.slice(0, 25), '']
      : []),
    'فایل‌های نصاب ویندوز (`.exe` / `.msi`) و بسته‌ی نصب اندروید (`.apk` / `.aab`) در بخش **Assets** زیر قابل دریافت هستند.',
  ].join('\n');
  fs.writeFileSync(path.resolve('release-notes.md'), releaseNotes, 'utf8');

  console.log(`Version bump: ${formatSemver(baseVersion)} -> ${versionStr} (${bumpType})`);
  console.log(`Reason: ${reason}`);

  if (process.env.GITHUB_OUTPUT) {
    const out = [
      `version=${versionStr}`,
      `tag=${tagStr}`,
      `bump=${bumpType}`,
      `reason=${reason}`,
      `files_changed=${filesChanged}`,
      `lines_changed=${linesChanged}`,
    ].join('\n');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, out + '\n', 'utf8');
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = [
      `### نسخه‌گذاری خودکار (${tagStr})`,
      `- **نوع تغییر:** \`${bumpType}\``,
      `- **دلیل:** ${reason}`,
      `- **آمار تغییر:** ${filesChanged} فایل · ${linesChanged} خط`,
      '',
    ].join('\n');
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary, 'utf8');
  }
}

main();
