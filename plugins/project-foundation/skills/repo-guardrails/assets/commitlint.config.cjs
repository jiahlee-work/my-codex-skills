const allowedTypes = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "test",
  "chore",
  "ci",
  "build",
  "perf",
  "revert",
];

module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-empty": [2, "never"],
    "type-case": [2, "always", "lower-case"],
    "type-enum": [2, "always", allowedTypes],
    "scope-empty": [2, "always"],
    "subject-empty": [2, "never"],
    "subject-case": [0],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 100],
    "header-format": [2, "always"],
    "subject-korean": [2, "always"],
  },
  plugins: [
    {
      rules: {
        "header-format": ({ header }) => {
          const pattern = new RegExp(`^(${allowedTypes.join("|")}):\\s\\S.+$`);

          return [
            pattern.test(header ?? ""),
            "commit message must match: {type}: {Korean summary}",
          ];
        },
        "subject-korean": ({ subject }) => {
          return [
            /[가-힣]/.test(subject ?? ""),
            "commit summary should include Korean text",
          ];
        },
      },
    },
  ],
};
