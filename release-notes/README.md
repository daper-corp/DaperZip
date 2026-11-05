# Release notes

`v<version>.md` here is the body of the GitHub release for that version.

Releasing:

```bash
scripts/bump-version.sh 0.1.1      # sets the version, creates release-notes/v0.1.1.md
# write the notes, then
git commit -am "Release 0.1.1" && git push origin main
```

When that push builds successfully on Windows, macOS and Linux, CI creates
tag `v0.1.1` and publishes the release with all installers attached.
Versions below 1.0.0 (or with a suffix such as `-beta.1`) are marked as
pre-releases. No notes file → no release (a warning shows in the run).
