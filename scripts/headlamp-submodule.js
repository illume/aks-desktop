#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

/**
 * Manages the Headlamp submodule without requiring Git Bash on Windows.
 * Uses only Node.js built-in modules (child_process, fs, path).
 *
 * Usage:
 *   node scripts/headlamp-submodule.js <ref>           # update submodule to upstream ref (no commit)
 *   node scripts/headlamp-submodule.js --commit <ref>  # commit current submodule pointer (no update)
 *   node scripts/headlamp-submodule.js --reset         # reset worktree to recorded commit in superproject
 *   (Order-insensitive: <ref> --commit works too.)
 *
 * Behavior:
 *   - With only <ref>: fetch/rebase submodule onto upstream ref (no commit).
 *   - With --commit <ref>: DO NOT update; just create a commit recording current pointer, using <ref> in message.
 *     (Assumes you've already updated the submodule to that ref.)
 *   - With --reset: restore submodule worktree to the superproject's recorded commit.
 *
 * Constraints:
 *   - --commit requires a <ref>.
 *   - --commit cannot be combined with --reset.
 *   - You cannot specify more than one <ref>.
 *
 * <ref> may be: branch name (e.g. main), tag (e.g. v0.35.0), or commit SHA/abbrev.
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.dirname(__dirname);
const headlampDir = path.join(ROOT_DIR, 'headlamp');

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.error('Usage: node scripts/headlamp-submodule.js <ref>|--reset|--commit <ref>');
  process.exit(args.length === 0 ? 1 : 0);
}

let ref = '';
let commitFlag = false;
let resetFlag = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--commit') {
    commitFlag = true;
  } else if (arg === '--reset' || arg === 'reset') {
    resetFlag = true;
  } else if (arg.startsWith('--')) {
    console.error('Unknown option: ' + arg);
    process.exit(1);
  } else {
    if (ref) {
      console.error('Error: multiple refs specified (' + ref + ', ' + arg + ').');
      process.exit(1);
    }
    ref = arg;
  }
}

if (commitFlag && resetFlag) {
  console.error('Error: --commit cannot be combined with --reset.');
  process.exit(1);
}

if (commitFlag && !ref) {
  console.error('Error: --commit requires a <ref>.');
  process.exit(1);
}

let mode;
if (resetFlag) {
  mode = 'reset';
} else if (commitFlag) {
  mode = 'commit-only';
} else {
  if (!ref) {
    console.error('Error: missing <ref>.');
    process.exit(1);
  }
  mode = 'update';
}

if (mode === 'reset') {
  console.log('[info] Resetting headlamp submodule to superproject recorded commit');
} else if (mode === 'commit-only') {
  console.log('[info] Commit-only mode: committing current submodule pointer (no update). Ref: ' + ref);
} else {
  console.log('[info] Updating headlamp submodule to ref: ' + ref);
}

process.chdir(ROOT_DIR);

/**
 * Run a shell command with inherited stdio, throwing on failure.
 * @param {string} cmd
 * @param {object} [opts]
 */
function run(cmd, opts) {
  execSync(cmd, Object.assign({ stdio: 'inherit' }, opts));
}

/**
 * Spawn a git command with explicit argument array (no shell interpolation).
 * Prints stdout/stderr and throws on non-zero exit.
 * @param {string[]} gitArgs
 * @param {object} [opts]
 */
function git(gitArgs, opts) {
  const result = spawnSync('git', gitArgs, Object.assign({ stdio: 'inherit' }, opts));
  if (result.error) {
    if (result.error.code === 'ENOENT') {
      throw new Error(
        'Failed to run "git": executable not found in PATH. ' +
        'Please install Git and ensure it is available on your PATH.'
      );
    }
    throw new Error('Failed to start git: ' + result.error.message);
  }
  if (result.signal) {
    throw new Error('git ' + gitArgs.join(' ') + ' terminated by signal ' + result.signal);
  }
  if (result.status !== 0) {
    throw new Error('git ' + gitArgs.join(' ') + ' exited with status ' + result.status);
  }
}

/**
 * Run a command and return stdout as a trimmed string.
 * @param {string} cmd
 * @param {object} [opts]
 * @returns {string}
 */
function capture(cmd, opts) {
  return execSync(cmd, Object.assign({ encoding: 'utf-8' }, opts)).trim();
}

/**
 * Validate a git ref so it cannot carry shell metacharacters.
 * Allows letters, digits, and the characters git itself allows in refs.
 * @param {string} value
 * @param {string} label  Used in the error message.
 */
function validateRef(value, label) {
  if (!/^[a-zA-Z0-9_./@\-]+$/.test(value)) {
    console.error('Error: ' + label + ' contains invalid characters: ' + value);
    process.exit(1);
  }
}

/**
 * Validate a remote URL: must be an https:// or git@ URL with no whitespace or control characters.
 * @param {string} value
 */
function validateUrl(value) {
  if (typeof value !== 'string') {
    console.error('Error: HEADLAMP_URL must be a string — got: ' + String(value));
    process.exit(1);
  }
  if (value !== value.trim()) {
    console.error('Error: HEADLAMP_URL must not contain leading or trailing whitespace — got: ' + JSON.stringify(value));
    process.exit(1);
  }
  // Disallow control characters/whitespace and require https:// or git@ prefix
  if (!/^(?!.*[\x00-\x1F\x7F])(https:\/\/\S+|git@\S+)$/.test(value)) {
    console.error('Error: HEADLAMP_URL must be an https:// or git@ URL with no whitespace or control characters — got: ' + value);
    process.exit(1);
  }
}

// Ensure submodule is initialized
const isInitialized =
  fs.existsSync(headlampDir) &&
  (fs.existsSync(path.join(headlampDir, '.git')) ||
    fs.existsSync(path.join(headlampDir, 'Makefile')));

if (!isInitialized) {
  console.log('[info] Initializing headlamp submodule...');
  run('git submodule update --init headlamp');
}

if (mode === 'reset') {
  const status = capture('git status --porcelain', { cwd: headlampDir });
  if (status) {
    console.warn('[warn] You have local changes inside submodule that will be overwritten by reset.');
  }
  run('git submodule update --init --checkout headlamp');
} else if (mode === 'commit-only') {
  console.log('[info] Skipping update (commit-only).');
} else {
  const headlampUrl =
    process.env['HEADLAMP_URL'] || 'https://github.com/kubernetes-sigs/headlamp.git';
  validateUrl(headlampUrl);
  validateRef(ref, '<ref>');
  console.log('[info] Resolving upstream ref \'' + ref + '\' from ' + headlampUrl);

  try {
    git(['pull', '--rebase', headlampUrl, ref], { cwd: headlampDir });
    console.log('[info] Rebase complete.');
  } catch (_err) {
    console.error('[conflict] Rebase stopped due to conflicts.');
    console.error('Resolve, then run: git rebase --continue (or --abort) inside headlamp/');
    process.exit(1);
  }
}

const currentDesc = capture('git log --oneline -1', { cwd: headlampDir });
console.log('[info] Headlamp now at: ' + currentDesc);

run('git add headlamp');

if (mode === 'reset') {
  console.log('[done] Submodule reset to recorded commit (no commit created).');
} else if (mode === 'commit-only') {
  let hasStagedChanges = false;
  try {
    execSync('git diff --cached --quiet headlamp', { stdio: 'pipe' });
  } catch (_err) {
    hasStagedChanges = true;
  }
  if (!hasStagedChanges) {
    run('git add headlamp');
    try {
      execSync('git diff --cached --quiet headlamp', { stdio: 'pipe' });
    } catch (_err) {
      hasStagedChanges = true;
    }
  }
  if (!hasStagedChanges) {
    console.log('[info] No submodule change to commit.');
  } else {
    const msg = 'headlamp: rebase to ' + ref;
    try {
      // Pass '-- headlamp' pathspec to avoid accidentally committing unrelated staged changes.
      git(['commit', '-m', msg, '--', 'headlamp']);
      console.log('[done] ' + msg);
    } catch (_err) {
      console.warn('[warn] Commit failed; please review.');
    }
  }
} else {
  console.log('[done] Submodule updated. Commit when ready:');
  console.log('  git commit -m \'headlamp: rebase to ' + ref + '\'');
}
