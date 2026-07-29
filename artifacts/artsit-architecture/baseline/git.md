# Git and worktree safety

## Commit gate

- Required starting commit: `748579a14877c8fd1a7030bbf6c32709fdf4dba2`
- Verified `HEAD` before branch creation: `748579a14877c8fd1a7030bbf6c32709fdf4dba2`
- Working branch: `research/artsit-extensible-activities`

## Pre-existing working-tree material

The following material existed before this task and was preserved:

- an unstaged iOS project version/build-number change in `ios/App/App.xcodeproj/project.pbxproj`;
- four untracked store screenshots below `artifacts/app-store-screenshots` and `artifacts/google-play-screenshots`;
- untracked publication-planning documents:
  - `publication/repository_publication_strategy.md`;
  - `publication/artsit_activity_architecture_plan.md`.

None of those files belongs to the baseline implementation commits.

## Isolation method

Capacitor synchronization and native builds can rewrite generated native files. They were therefore run in `<temporary-copy>`, copied from the working source while excluding:

- `.git`;
- `node_modules`;
- `www`;
- `artifacts`;
- `publication`.

The copy used the installed dependency tree only to avoid a redundant installation. Any generated absolute dependency paths were treated as copy-local artifacts, not repository defects.
