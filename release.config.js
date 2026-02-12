/**
 * @type {import('semantic-release').GlobalConfig}
 */
const config = {
  branches: ["main"],
  repositoryUrl: "https://github.com/PaulKinlan/NotebookLM-Chrome",
  tagFormat: "v${version}",
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      {
        changelogFile: "CHANGELOG.md",
      },
    ],
    [
      "@semantic-release/npm",
      {
        npmPublish: false,
      },
    ],
    [
      "@semantic-release/exec",
      {
        prepareCmd: "node scripts/version.js",
      },
    ],
    [
      "@semantic-release/git",
      {
        assets: ["package.json", "manifest.json", "CHANGELOG.md"],
        message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
    [
      "@semantic-release/exec",
      {
        successCmd: "npx tsx scripts/publish-cws.ts",
      },
    ],
    [
      "@semantic-release/github",
      {
        successComment: false,
        failComment: false,
        assets: [
          { path: "foliolm-extension-*.zip", label: "FolioLM Extension ZIP" },
        ],
      },
    ],
  ],
};

export default config;
