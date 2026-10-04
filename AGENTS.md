# Project Learnings

- Extension scan/import spans `src/main/index.ts`, `src/shared/types.ts`, and the renderer. Candidate IDs are keys in the pending-scan map; keep the ID and payload contract aligned across scanning, selection, and import.
- Scan tokens are one-shot: a new scan clears pending scans, and importing deletes its token in `finally`, including on failure. Retry by scanning again.
- Import limits are enforced in the main process: folder trees and ZIP uncompressed contents are capped at 1 GiB, while imports over 128 MiB require confirmation. UI warnings are not enforcement; keep the main-process checks authoritative.
- Chromium manifest names using `__MSG_...__` resolve through `_locales/<default_locale>/messages.json`; scanning and direct import both use localized `name` with `short_name` fallback.
- The Windows installer installs the app but does not migrate user data. The library is stored at `app.getPath('userData')/web-apps.json` and extension files under that user-data directory, separately from the installer.
