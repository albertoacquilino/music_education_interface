import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const repositoryRoot = process.cwd();
const comparisonPoint = '45daf1c';
const plpControllerPath =
  'src/app/activities/prepare-listen-play/prepare-listen-play.controller.ts';
const targetDomainFiles = [
  'src/app/activities/target-intonation/intonation-evaluator.ts',
  'src/app/activities/target-intonation/target-intonation.controller.ts'
];
const forbiddenDomainTokens = [
  '@angular/',
  '@ionic/',
  'document.',
  'window.',
  'AudioContext',
  'WebAudio',
  'firebase',
  '@capacitor/',
  'howler'
];

const checks = [];

const frozenPlp = gitShow(`${comparisonPoint}:${plpControllerPath}`);
const currentPlp = readFileSync(join(repositoryRoot, plpControllerPath), 'utf8');
checks.push({
  name: 'plp-controller-frozen',
  passed: sha256(frozenPlp) === sha256(currentPlp),
  details: {
    comparisonPoint,
    frozenSha256: sha256(frozenPlp),
    currentSha256: sha256(currentPlp)
  }
});

for (const file of targetDomainFiles) {
  const content = readFileSync(join(repositoryRoot, file), 'utf8');
  const found = forbiddenDomainTokens.filter(token => content.includes(token));
  checks.push({
    name: `dom-free-domain:${file}`,
    passed: found.length === 0,
    details: { forbiddenTokensFound: found }
  });
}

const sharedCoreFiles = filesUnder('src/app/core');
const activityImportsInCore = sharedCoreFiles.flatMap(file => {
  const content = readFileSync(join(repositoryRoot, file), 'utf8');
  return content.includes('/activities/') ? [file] : [];
});
checks.push({
  name: 'no-activity-module-imports-in-shared-core',
  passed: activityImportsInCore.length === 0,
  details: { files: activityImportsInCore }
});

const routes = readFileSync(
  join(repositoryRoot, 'src/app/app.routes.ts'),
  'utf8'
);
checks.push({
  name: 'independent-activity-routes',
  passed:
    routes.includes("path: 'exercise'")
    && routes.includes("path: 'intonation'"),
  details: {
    expected: ['/home/exercise', '/home/intonation']
  }
});

const failed = checks.filter(check => !check.passed);
const evidence = {
  comparisonPoint,
  generatedAt: new Date().toISOString(),
  passed: failed.length === 0,
  checks
};

process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
if (failed.length > 0) {
  process.exitCode = 1;
}

function filesUnder(directory) {
  const absoluteDirectory = join(repositoryRoot, directory);
  return readdirSync(absoluteDirectory).flatMap(name => {
    const absolutePath = join(absoluteDirectory, name);
    const relativePath = relative(repositoryRoot, absolutePath);
    if (statSync(absolutePath).isDirectory()) {
      return filesUnder(relativePath);
    }
    return relativePath.endsWith('.ts') ? [relativePath] : [];
  });
}

function gitShow(objectName) {
  const result = spawnSync('git', ['show', objectName], {
    cwd: repositoryRoot,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `Unable to read ${objectName}`);
  }
  return result.stdout;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
