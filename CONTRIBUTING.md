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

The host pins a released module commit when the Git submodule is configured. Merging module code alone does not release a new site. The host maintainer updates the pin, runs the short integration checks, then deploys both Workers if needed.
