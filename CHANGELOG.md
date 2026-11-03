# Changelog

## 0.1.0 (2026-10-27)

- Initial release: `build_onboard_map` MCP tool and `map`
  CLI command building a newcomer map from
  caller-supplied repository facts only; no repository
  is read.
- Files grouped into areas by first path segment (or
  `(root)`), areas sorted code-unit ascending, each area
  reporting its file count, test-file count, entry
  points in input order, and distinct owners sorted
  code-unit ascending.
- Test-file detection by basename containing `.test.`
  or `.spec.`, or a directory segment exactly `test`,
  `tests`, `__tests__`, or `spec`. Ownership by
  longest-prefix matching with the pinned clauses;
  entry points missing from the file list are reported,
  not an error; `test_command` echoes verbatim or is
  `null`.
- Path-naming validation errors for malformed input and
  a duplicate-path error naming the duplicated path; no
  partial results on invalid input.
