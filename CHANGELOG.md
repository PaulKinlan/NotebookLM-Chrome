# [0.6.0](https://github.com/PaulKinlan/NotebookLM-Chrome/compare/v0.5.0...v0.6.0) (2026-01-16)


### Bug Fixes

* **release:** sync versions with git tags and fix semantic-release config ([#77](https://github.com/PaulKinlan/NotebookLM-Chrome/issues/77)) ([e98760e](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/e98760ef53cc84f08d2d166a5ff910edd316a292))
* **sidepanel:** append transform cards to DOM before rendering content ([9c4a8c4](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/9c4a8c402849736c9a9d999925852408f7736f0e))
* **sidepanel:** auto-fix all stylistic linting errors ([#78](https://github.com/PaulKinlan/NotebookLM-Chrome/issues/78)) ([d6123cd](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/d6123cda9cb64151b4cf04032fa67b31bff7bbd4))
* **sidepanel:** rebuild context menus when notebooks are created/deleted ([#75](https://github.com/PaulKinlan/NotebookLM-Chrome/issues/75)) ([60d5e60](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/60d5e6050e18fd7a23baa0530e20bb7c2a862ab0))
* **sidepanel:** render restored transforms using correct rendering path ([5219d6c](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/5219d6c8c1b827d2cb0bece0b94bb4828627ae5d))
* **sidepanel:** restore complete onboarding flow with AI setup ([#76](https://github.com/PaulKinlan/NotebookLM-Chrome/issues/76)) ([a342563](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/a3425632c9cc283881facc5265425cf364e6ff7e))
* **sidepanel:** restore sandbox layer for inline script CSP support ([5b6a4a4](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/5b6a4a464414b7bf3c9011c806df85c9aa41d59a))
* **sidepanel:** use Base64 encoding for fullscreen content embedding ([4634df0](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/4634df06126cb7f5f7f29ed49b224eebd45c9084))
* **sidepanel:** use chrome.tabs.sendMessage for fullscreen content delivery ([7c2a75e](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/7c2a75e4678241ea140c95fa1b1259a1db4aeae3))
* **sidepanel:** use dedicated sandbox page for fullscreen transforms ([5517b72](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/5517b7292ddce46637e489f59d91b8be9c2361ae))
* **sidepanel:** use double-iframe/blob architecture for fullscreen transforms ([455bfb5](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/455bfb5019b00b82454a64e36db40f8dbde55caa))
* **sidepanel:** use isHtmlContent() for restored transform detection ([075395f](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/075395f6b0603498b2654686ff387d266e8fb37e))
* **sidepanel:** use sandbox attribute as security boundary for fullscreen ([f81cc1d](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/f81cc1d4c1e9e9b34a2dc5ba06f14deedb9e639d))
* **sidepanel:** use srcdoc instead of blob URL for content rendering ([11c4940](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/11c4940eecbfe8aeceb5ecf8440f707733284868))
* **sidepanel:** use wrapper/bridge pattern for fullscreen sandbox communication ([f1bb641](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/f1bb64159445d6a864ee63a5e4eeea5cd105409a))


### Features

* **sidepanel:** load per-notebook transform history when switching folios ([26b0ffd](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/26b0ffd288baa6533e9a54abecfed1cd04f64f94))

# [0.5.0](https://github.com/PaulKinlan/NotebookLM-Chrome/compare/v0.4.0...v0.5.0) (2026-01-15)


### Features

* add BroadcastChannel notifications to storage operations ([2741c93](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/2741c934d1a5ba002a6568eef2999b730736ef93))
* add BroadcastChannel utility for cross-context sync ([cda6d87](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/cda6d87a13a6ab91b5e8d97ce05e7542952d6bf9))
* add global signals store for app state ([9ef32cd](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/9ef32cdd2220dfec38fb4b75d4d73cc6ed40efb7))

# [0.2.0](https://github.com/PaulKinlan/NotebookLM-Chrome/compare/v0.1.0...v0.2.0) (2026-01-15)


### Bug Fixes

* address PR review comments for chrome-ai module ([3b68077](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/3b680778499802dd868340b14b30cb8aa2b3b46a)), closes [#1](https://github.com/PaulKinlan/NotebookLM-Chrome/issues/1) [#2](https://github.com/PaulKinlan/NotebookLM-Chrome/issues/2) [#3](https://github.com/PaulKinlan/NotebookLM-Chrome/issues/3) [#4](https://github.com/PaulKinlan/NotebookLM-Chrome/issues/4)


### Features

* **onboarding:** auto-download Chrome AI model on user gesture ([40f631c](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/40f631cbf874b80af15bb1f42144b5bfd966b88b))

# [0.1.0](https://github.com/PaulKinlan/NotebookLM-Chrome/compare/v0.0.1...v0.1.0) (2026-01-15)


### Bug Fixes

* address PR review feedback for transform panel ([d95339f](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/d95339f1d1c69c4fc41e0e88aee33bcfb261fd4e))
* **commitlint:** add release and commitlint scopes ([4538b94](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/4538b943b45474b2f8e244a29431bc48e35008ae))
* resolve no-misused-promises error in controllers.ts ([f902f68](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/f902f6893b50b54a4643c9f5b6eb0b5a38eb8428))


### Features

* add Chrome Web Store publishing script ([ee260c0](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/ee260c09f01ebe1226c5abd69e9532d3e3b42fb9))
* add transform persistence, deletion, and full-screen viewing ([79cc5da](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/79cc5dac84abef1c081b1eea429aad5881200961))
* integrate Chrome Web Store publishing into semantic-release ([db35a87](https://github.com/PaulKinlan/NotebookLM-Chrome/commit/db35a87d2ecedd13963534b50efe0dedff3d5017))
