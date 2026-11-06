# WinGet

Package identifier: `DaperCorp.DaperZip`

The manifests live under `manifests/` so they can be copied straight into
[`microsoft/winget-pkgs`](https://github.com/microsoft/winget-pkgs).

## First submission (one time)

A package must already exist in winget-pkgs before
`.github/workflows/winget.yml` can update it automatically.

1. Create a **classic** personal access token with the `public_repo` (and
   `workflow`) scopes.
2. Validate the manifests:

   ```powershell
   winget validate --manifest packaging\winget\manifests\d\DaperCorp\DaperZip\0.1.3
   ```

3. Submit the package (this forks winget-pkgs and opens a PR):

   ```powershell
   wingetcreate submit --prtitle "New package: DaperCorp.DaperZip 0.1.3" `
     --token <PAT> packaging\winget\manifests\d\DaperCorp\DaperZip\0.1.3
   ```

4. Merge the PR in `microsoft/winget-pkgs`.
5. Add the same PAT as the repository secret `WINGET_TOKEN`.
6. If the winget-pkgs fork is under a user account instead of `daper-corp`,
   add the repository variable `WINGET_FORK_USER` with that username.

Users can then install with:

```powershell
winget install DaperCorp.DaperZip
```

## New versions

`.github/workflows/winget.yml` runs when a release is published and opens a
winget-pkgs PR for the new version. Without `WINGET_TOKEN` the step is skipped.

The `0.1.3` directory is a reference for the first submission; the action
generates later manifests from the version already in winget-pkgs.
