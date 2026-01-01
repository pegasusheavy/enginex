export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Type must be one of the following
    "type-enum": [
      2,
      "always",
      [
        "feat", // New feature
        "fix", // Bug fix
        "docs", // Documentation only
        "style", // Code style (formatting, semicolons, etc)
        "refactor", // Code refactoring
        "perf", // Performance improvement
        "test", // Adding or updating tests
        "build", // Build system or dependencies
        "ci", // CI/CD configuration
        "chore", // Other changes (maintenance)
        "revert", // Revert previous commit
      ],
    ],
    // Subject must not be empty
    "subject-empty": [2, "never"],
    // Type must not be empty
    "type-empty": [2, "never"],
    // Subject max length
    "subject-max-length": [2, "always", 100],
    // Header max length
    "header-max-length": [2, "always", 120],
  },
};
