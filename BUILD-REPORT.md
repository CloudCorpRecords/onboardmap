# onboardmap — Build Report

MCP Rebuild 1000, Batch 19. Original program build from the
packages-100 plan (cluster D #42), built from the spec in
`~/workspace/mcp-rebuild-100/specs-batch19/onboardmap.md`
(read first). There is no external original; the tool surface
is the program's defined spec. Local build only — nothing
pushed or published.

Identity: repo `onboardmap`, npm `@reneturcios/onboardmap`,
MCP name `io.github.CloudCorpRecords/onboardmap`, version
`0.1.0`, bin `onboardmap` → `dist/cli.js`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json`, `server.json` (description "Build a
  newcomer map from supplied repo facts: areas, entry
  points, tests, and owners." — 86 chars, verified by
  count; npm entry carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/onboardmap:0.1.0` carries **no**
  `version` field), `Dockerfile` (node:20-alpine two-stage,
  label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/onboardmap"`),
  `tsconfig.json` (byte-identical to the reference,
  verified by byte comparison, 318 bytes),
  `.gitignore`, `LICENSE` (MIT, Copyright (c) 2026 Rene
  Turcios), `README.md` (fresh text), `CHANGELOG.md`
  (single 0.1.0 entry, 2026-10-27), `package-lock.json`
  (Route 3, see below)
- `src/index.ts`, `src/cli.ts` (`map --input <args.json>`
  where the file holds the full arguments object, `mcp`,
  `--version`; exit 2 usage / 1 runtime error, argument
  validation before any file read), `src/mcp.ts`,
  `src/types.ts`, `src/onboardmap.ts` (core,
  `VERSION = "0.1.0"`, `buildOnboardMap`, `formatPayload`)
- `test/onboardmap.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (publish-container `IMAGE = ghcr.io/cloudcorprecords/onboardmap`,
  smoke-test server-name assertion `onboardmap`; the other
  three workflows are byte-identical to the reference)

Plus the parity fixture at
`harness/fixtures/onboardmap-tools-original.json`, labelled
as a program spec from the packages-100 plan cluster D #42.

## Tools implemented (1)

- `build_onboard_map` — arguments: `files` (array of
  strings, required, at least 1 item), `entry_points`
  (array of strings, optional, absent means []),
  `test_command` (string, optional), and `owners` (object,
  optional, absent means {}; encoded in the schema literal
  as `{type: "object", additionalProperties: {type:
  "string"}}` per the spec's own schema). Required is
  exactly `["files"]` at the top level.

  Test-file detection is pinned, two clauses: the basename
  (segment after the last "/") contains ".test." or
  ".spec.", OR any directory segment (every segment except
  the last) is exactly "test", "tests", "__tests__", or
  "spec". A basename merely starting with "test" matches
  neither clause and is not a test file.

  A file's area is its first path segment, or the literal
  "(root)" when the path contains no "/". Areas are sorted
  code-unit ascending. Each area entry is {area, files,
  tests, entry_points, owners} in that key order, with
  entry_points in input order and owners the distinct
  owners of the area's files sorted code-unit ascending.

  Ownership is pinned: a key K matches a file F when
  F === K, or K ends with "/" and F starts with K, or F
  starts with K + "/". The longest matching key wins; a
  file matched by no key is unowned.

  Returns {areas, entry_points, missing_entry_points,
  test_files, unowned_files, test_command, counts} in
  that key order. entry_points echoes the found entry
  points in input order; missing ones are reported under
  missing_entry_points in input order (not an error).
  test_files and unowned_files are sorted code-unit
  ascending. test_command echoes verbatim (an empty
  string included) or is null when absent. counts is
  {files, test_files, areas, entry_points, unowned} in
  that key order, its entry_points counting only the
  entry points found in files.

  The fixture literal
  (`harness/fixtures/onboardmap-tools-original.json`) and
  the `src/mcp.ts` literal are identical, with no `$schema`
  key and no harness-level `additionalProperties` beyond
  the spec's own owners encoding — confirmed by the
  parity run below.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with an
  explicit inputSchema literal exactly matching the
  fixture, per the standing fleet rule (no McpServer/zod
  schema conversion). Every `tools/call` is validated by
  the core itself, so the MCP and CLI paths share one
  validation implementation; the core takes the full
  arguments object.
- Validation is path-naming and total: a missing,
  non-array, or empty `files`; a non-string or empty
  `files[i]`; a non-array `entry_points` or a non-string
  or empty `entry_points[i]`; a non-string
  `test_command`; a non-object `owners`, an empty owners
  key, or a non-string or empty owners value throws an
  Error naming the offending path (e.g. `files[2] must be
  a non-empty string`) and produces no partial result
  (MCP: `isError`; CLI: exit 1). Duplicate `files` paths
  throw `duplicate file path: <path>`. Unknown extra
  fields are ignored; a non-object top-level argument is
  treated as {}.

## Verification (foreground, this session)

- `npm test` (`tsx --test test/*.test.ts`): **62 tests,
  62 pass, 0 fail** — test-file detection (basename
  ".test." and ".spec." clauses including at root,
  ".test" without a trailing dot rejected, directory
  clauses for test / tests / __tests__ / spec including
  deep segments, near-miss directory names and a file
  named "tests" rejected, the "testfoo.ts / test.ts is
  not a test" negatives, sorted test_files); areas
  (first segment, (root), code-unit sorting with (root)
  by its literal characters, per-area file/test counts,
  per-area entry points in entry-point input order, a
  root entry point, distinct sorted area owners, pinned
  area key order); entry points (found in input order,
  missing reported in input order and never in an area,
  counts counting only found, absent and empty equivalent);
  ownership (all three match clauses, the slash boundary
  — `src` does not own `srcfoo/a.ts` — trailing-slash
  keys, longest-prefix wins including the trailing-slash
  twin and three nested prefixes, absent/empty owners
  meaning all unowned, sorted unowned_files, distinct
  collapse); test_command (verbatim, null when absent,
  empty string echoing verbatim); output shape (pinned
  top-level and counts key orders, a full hand-checked
  map, minimal single-file counts); duplicate-path errors
  naming the path; and every validation path (files
  missing / non-array / empty, files entries, entry_points
  non-array and bad entries, test_command non-string,
  owners non-object / empty key / bad values for string,
  number, null, and array, non-object top-level treated
  as {}, unknown extras ignored, no partial result).
- `npx tsc --noEmit` → exit 0; `npm run build` produced
  `dist/` with all 15 outputs.
- `dist/cli.js --version` → `0.1.0`; unknown command exits
  2 with usage; `map` with no `--input` exits 2;
  `map --input <valid file>` exits 0 and prints the
  hand-checked map for the input `{"files": ["README.md",
  "src/index.ts", "src/parser.ts", "src/parser.test.ts",
  "tests/helpers/setup.ts", "docs/guide.md"],
  "entry_points": ["src/index.ts", "src/main.ts"],
  "test_command": "npm test", "owners": {"src": "alice",
  "docs": "bob"}}` — areas (root) / docs / src / tests
  with src holding 3 files and 1 test, entry_points
  `["src/index.ts"]`, missing `["src/main.ts"]`,
  test_files `["src/parser.test.ts",
  "tests/helpers/setup.ts"]`, unowned `["README.md",
  "tests/helpers/setup.ts"]`, test_command `"npm test"`,
  counts files 6, test_files 2, areas 4, entry_points 1,
  unowned 2; `map --input <invalid file>` (third file the
  number 42) exits 1 with
  `error: files[2] must be a non-empty string`.
- Parity: `harness/parity.py` vs
  `harness/fixtures/onboardmap-tools-original.json` →
  **PASS, parity 100.0, identical_tools 1/1** (run with
  the rebuild path as an absolute path; the harness does
  not expand a `~` inside the quoted stdio command
  string). Report saved under `parity-out/`.

## Lockfile status

`package-lock.json` generated clean via Route 3 (in the
build directory with no `node_modules` present, offline
`npm install --package-lock-only --ignore-scripts
--offline`), verified: parses, name
`@reneturcios/onboardmap`, **128 package entries**. The
subsequent offline `npm install --ignore-scripts
--offline`, build, tests, and parity all ran against
this lockfile's tree.

## Gaps / honest notes

- **Spec ambiguities resolved** (each pinned with a test
  where applicable): (1) error-message wording follows
  the fleet's path-naming pattern — the spec gives the
  example `files[2] must be a non-empty string` and
  `duplicate file path: X`; for owners I use `owners key
  must be a non-empty string` for an empty key and
  `owners["<key>"] must be a non-empty string` for a bad
  value, and distinct messages for a missing `files`
  (`files is required`) versus a malformed one (`files
  must be a non-empty array`), matching the reference
  build's pattern; (2) duplicate values inside
  `entry_points` are not called out by the spec (only
  duplicate file paths are an error), so entry points
  are echoed and reported exactly as supplied, in input
  order, duplicates included; (3) when two distinct
  owner keys of equal length both match a file (possible
  only across the exact-match and slash clauses), the
  first key in the owners object wins, since the spec
  pins longest-wins and is silent on ties — implemented
  as a strict-greater comparison; (4) sorting is the
  default JavaScript string sort (code-unit ascending)
  everywhere the spec says code-unit ascending, pinned
  with mixed-case sets where capitals sort before
  lowercase. No other spec ambiguity was found in the
  core behaviour.
- Container build not exercised locally; the
  publish-container workflow smoke-tests the image at
  publish time.
- Nothing pushed or published; this is a local build only.
