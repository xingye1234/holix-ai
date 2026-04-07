# Release Notes - v0.1.1-alpha.1

## Alpha Preview

`0.1.1-alpha.1` is an early alpha release. The app is usable, but there are still rough edges in product experience, interaction details, and stability. This build is intended for continued internal use and early testing rather than a polished public release.

## Highlights

### Skills

- Reworked the skills system around `metadata.json + SKILL.md`.
- Removed the old skills context/loading strategy and unified skills into a single runtime path.
- Skills now load only from the built-in directory and `.holixai/skills`.
- Added importing skills from other AI tools into the local skills directory by copying them into the current app workspace.

### Chat And Settings

- Merged provider/model selection into a single combined selector.
- Moved session actions such as rename, expiry, and delete into the right-side settings panel.
- Adjusted title generation to happen after the first message instead of during room creation.
- Improved chat layout, sidebar structure, and several interaction details around the main chat experience.

### UI And Theming

- Added app theme settings and separate code theme settings.
- Added provider avatar upload plus built-in avatar choices.
- Refined the new chat page, input styling, and several settings surfaces to better match the overall visual system.
- Continued filling in missing i18n strings across the app.

### Engineering

- Continued moving chat execution toward the Deep Agent-based session architecture.
- Simplified skills-related runtime logic and removed legacy compatibility paths.
- Cleaned up type issues, lint configuration, tests, and build warnings to improve the release baseline.

## Known Status

- This is still an alpha-stage product.
- Core workflows are available, but behavior and UI may continue to change quickly.
- Release notes are manually curated for readability; the full commit-level history remains in `CHANGELOG.md`.

---

*Generated on 2026-04-07*
