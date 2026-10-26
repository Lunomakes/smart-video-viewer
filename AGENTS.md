# Project workflow

- Maintained source: `Smart Video Viewer/`. Design sources and approved icon masters: `design/`.
- Use Git commits for source history and rollback. Do not create additional local backup copies, `.backup` files, or versioned backup directories unless the user explicitly requests them.
- Existing local originals, build outputs, release packages, and backups are ignored by Git. Do not delete them without explicit approval.
- Keep generated build/release artifacts and machine-specific Xcode state out of commits.
- For icon exports, follow `design/focus-optical-2026-10-06/approved-raster/README.md` and inspect every exported size. A correct SVG or large preview does not verify small PNG exports.
- Publishing: solo project. Commit on `main` and push directly to `origin/main` (https://github.com/Lunomakes/smart-video-viewer); no PR needed.
