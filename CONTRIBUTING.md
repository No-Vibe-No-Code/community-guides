# Contributing

Use the website editor to contribute a guide. Code contributions improve the editor, reader and publishing system.

1. Fork this repository and make a branch, or use a branch if a maintainer has given you write access.
2. Run the local preview with Node 24 and `npm run dev`.
3. Make a focused change. Preserve existing account boundaries, private drafts, revision checks and the reduced-motion experience.
4. Run `npm test` and `npm run check`. Use short, relevant checks; do not run long test suites.
5. Open a pull request explaining the user-visible change and how you checked it. Include a screenshot for UI changes.

Public contributions do not automatically receive write access to the repository or production. Only maintainers release code. A guide submitted through the website publishes through the account-backed API; it does not create a GitHub commit.

Never commit tokens, `.env` files, `.dev.vars`, production database exports or real account sessions. Preview accounts are disposable local fixtures. Pull-request checks must not receive deployment credentials or execute with `pull_request_target`.

For schema changes, add an ordered migration and coordinate the corresponding host migration before deployment. For an API or rendering change, check the old published version of a guide while editing its new private draft. Preserve stable step IDs on edits so members do not lose their progress.

## Maintainer releases

The host pins a released module commit in its `community/` Git submodule. Merging module code alone does not release the website.

1. Run `npm run check` and `npm test` here, commit the change, and push this repository's `main` first. Confirm the child commit is available on GitHub before updating the host.
2. In the host, run `git submodule update --init --recursive`, fetch the child's `main`, and check out the reviewed published child commit in `community/`.
3. Run `npm run build:guides` and `npm run test:community` in the host. Commit the `community` pin and any integration changes, integrate newer remote work without force-pushing, and push the host's `main`.
4. Deploy through the host scripts. Deploy the main Worker first if API code or bindings changed, then Guides using `npm run deploy:guides`. This builds `guides/published` and retains competition route/asset gating. Verify the live page and release before recording deployment facts in the host documentation.

Release pin updates are manual; there is no automatic dispatch. Contributor and pull-request checks have read-only repository permissions and receive no deployment secrets. Keep `demo/` local. Source extraction and pin updates do not recreate D1/R2 storage or reapply an already-applied migration.
