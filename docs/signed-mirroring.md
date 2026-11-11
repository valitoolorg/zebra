# Signed mirroring and deployment

Gitea is the development source and GitHub is the deployment mirror. Changes to
the default branch must retain valid, verified signatures on both hosts.

## Restored history

The repositories had diverged: GitHub contained two additional commits for lazy
PDF attachment loading and the pnpm deployment, while Gitea contained the unsigned
VAT/XML fixes. A new server-signed commit, `814a7e2`, combines their changes and
the dependency audit remediation. Its parent is the existing GitHub head
`82bb0b2`, so GitHub can fast-forward without removing either earlier commit.
The previous Gitea head `3777e9f` remains available on the protected
`archive/pre-signing-master-20261111` branch. Existing issue and PR records are
retained.

The signed commit's tree was compared with the tested local tree before the
approved one-time Gitea default-branch change. Gitea and GitHub then reported the
same head, and the mirror completed without errors. GitHub displayed Verified.

## Ongoing changes

- Gitea signs server-generated file changes and squash merges with the existing
  server signing key. The private key remains on the server.
- The corresponding public key is registered on GitHub as a signing-only key.
  Its committer identity matches an identity verified by the owning GitHub account.
- Gitea's default branch requires signed commits, blocks force pushes, and blocks
  administrative merge overrides. Only squash merges are offered for this repo.
- GitHub's signature requirement, force-push block, and deletion restriction
  remain enabled with no bypass actors.
- Rebase merges that retain unsigned topic commits must not be used for this
  mirrored mainline. A signed merge commit alone does not repair unsigned ancestors.

After a merge, verify the new commit's signature and matching default-branch SHAs
on both hosts. Confirm that the push mirror has no error; requesting a sync is
not itself evidence of success. Concurrent manual and automatic sync requests can
race, so inspect the actual remote refs before retrying a failed request.

## Actions

The GitHub Pages workflow is specific to GitHub. Its jobs check `github.server_url`
and are skipped on other Actions-compatible hosts. A skipped run is not a build
or test result. The repository does not claim a Gitea CI runner merely because
the workflow is recognized there.

Local audit, security-test, browser-test and build evidence is documented in
[Dependency audit remediation](npm-audit.md). Production deployment must be
verified separately through the GitHub Pages workflow.

Configuration reference: [Gitea commit signing](https://docs.gitea.com/administration/signing/).
