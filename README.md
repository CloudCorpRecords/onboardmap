# onboardmap

Joining a codebase is mostly a geography problem: where
does the program start, where do the tests live, how do
you run just one of them, and who do you ask about a
given corner? onboardmap draws that map from facts you
already have. You supply the repository's file paths,
the paths you consider entry points, the command that
runs the tests if you want it recorded, and a set of
path prefixes with the person or team that owns each
one. onboardmap hands back the map: the files grouped
into areas, the entry points that actually exist, the
ones you named that are missing, every test file, every
file nobody owns, and the tallies. It never opens the
repository; the map comes from the supplied facts only.

A file's area is the first segment of its path, so
everything under `src/` belongs to the `src` area and a
file sitting at the top level, with no slash in its
path, belongs to an area literally called `(root)`.
Areas come back sorted ascending, and each one reports
how many files it holds, how many of those are tests,
which entry points live inside it in the order you
named them, and the distinct owners of its files,
also sorted.

A file counts as a test file in two ways. Its basename
— the part after the last slash — may contain `.test.`
or `.spec.`, as in `parser.test.ts`. Or one of its
directory segments may be exactly `test`, `tests`,
`__tests__`, or `spec`, as in `tests/helpers/setup.ts`.
A name that merely starts with the letters t-e-s-t,
like `testfoo.ts` or a folder called `testing`, matches
neither rule and is not a test file.

Ownership is prefix matching with a longest-match rule.
A prefix owns a file when the file equals the prefix,
when the prefix ends with a slash and the file starts
with it, or when the file starts with the prefix plus a
slash — so `src` owns `src/app.ts` but not
`srcfoo/app.ts`. When two prefixes both match, the
longer one wins, which lets a broad owner cover a whole
tree while a narrower prefix carves out one subtree for
someone else. Files no prefix matches are listed as
unowned.

An entry point you name that is not in the file list is
not an error — building a map for a newcomer is exactly
when you want to learn that the documented starting
point does not exist. Found entry points are echoed in
your order, missing ones are reported separately in
your order, and the entry-point count in the tallies
counts only the found ones. The test command is echoed
word for word, an empty string included, or reported
as `null` when you leave it out.

Malformed input — a missing, empty, or non-array file
list, a non-string or empty file path, a bad entry-point
list, a non-string test command, or an owners map with
an empty key or an empty or non-string value — is a
validation error naming the offending path, with no
partial result. Two files with the same path are an
error naming the duplicated path. Unknown extra fields
are ignored.

## CLI

```bash
npx @reneturcios/onboardmap map --input args.json
npx @reneturcios/onboardmap --version
```

`args.json` contains the full arguments object:

```json
{
  "files": [
    "README.md",
    "src/index.ts",
    "src/parser.ts",
    "src/parser.test.ts",
    "tests/helpers/setup.ts",
    "docs/guide.md"
  ],
  "entry_points": ["src/index.ts", "src/main.ts"],
  "test_command": "npm test",
  "owners": {
    "src": "alice",
    "docs": "bob"
  }
}
```

The map is printed as JSON:

```json
{
  "areas": [
    {
      "area": "(root)",
      "files": 1,
      "tests": 0,
      "entry_points": [],
      "owners": []
    },
    {
      "area": "docs",
      "files": 1,
      "tests": 0,
      "entry_points": [],
      "owners": ["bob"]
    },
    {
      "area": "src",
      "files": 3,
      "tests": 1,
      "entry_points": ["src/index.ts"],
      "owners": ["alice"]
    },
    {
      "area": "tests",
      "files": 1,
      "tests": 1,
      "entry_points": [],
      "owners": []
    }
  ],
  "entry_points": ["src/index.ts"],
  "missing_entry_points": ["src/main.ts"],
  "test_files": ["src/parser.test.ts", "tests/helpers/setup.ts"],
  "unowned_files": ["README.md", "tests/helpers/setup.ts"],
  "test_command": "npm test",
  "counts": {
    "files": 6,
    "test_files": 2,
    "areas": 4,
    "entry_points": 1,
    "unowned": 2
  }
}
```

Exit codes: `0` on success, `1` on a runtime error
(including an unreadable or invalid input file, or
invalid input), `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/onboardmap mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "onboardmap": {
      "command": "npx",
      "args": ["-y", "@reneturcios/onboardmap", "mcp"]
    }
  }
}
```

### Tools

- `build_onboard_map` — Build a newcomer map from
  caller-supplied repository facts: files grouped into
  areas, entry points, where the tests live, and who
  owns what.
  - `files` (array of strings, required, at least 1
    item) — repository file paths, repo-relative, in
    the caller's order
  - `entry_points` (array of strings, optional) —
    paths the caller names as entry points; absent
    means none
  - `test_command` (string, optional) — command that
    runs the test suite, echoed into the map
  - `owners` (object, optional) — map from path prefix
    to owner name; absent means no owners

  Returns `{areas, entry_points, missing_entry_points,
  test_files, unowned_files, test_command, counts}`,
  where `areas` holds one `{area, files, tests,
  entry_points, owners}` per area, and `counts` is
  `{files, test_files, areas, entry_points, unowned}`.

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/onboardmap
docker run --rm -v "$PWD:/w" ghcr.io/cloudcorprecords/onboardmap map --input /w/args.json
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (pure local, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
