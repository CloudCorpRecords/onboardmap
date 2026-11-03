import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildOnboardMap } from "../src/onboardmap.js";

/**
 * All tests are pure local computation over inline file
 * lists: no repository, no filesystem, no network. Both
 * test-file clauses plus the testfoo negative, the area
 * rule including (root), ownership (all three match
 * clauses, longest-prefix wins, trailing-slash keys,
 * the slash-boundary), entry points found and missing,
 * test_command null / verbatim / empty echo, sorting,
 * counts, the duplicate-path error, and every validation
 * path are each pinned.
 */

type Extra = Record<string, unknown>;

const build = (files: unknown, over: Extra = {}) =>
  buildOnboardMap({ files, ...over });

describe("buildOnboardMap — test-file detection: basename clause", () => {
  it("a basename containing .test. is a test file", () => {
    const out = build(["src/parser.test.ts", "src/parser.ts"]);
    assert.deepEqual(out.test_files, ["src/parser.test.ts"]);
  });

  it("a basename containing .spec. is a test file", () => {
    const out = build(["src/parser.spec.ts", "lib/widget.spec.js"]);
    assert.deepEqual(out.test_files, [
      "lib/widget.spec.js",
      "src/parser.spec.ts",
    ]);
  });

  it("a root-level basename with .test. is a test file (no directory needed)", () => {
    const out = build(["foo.test.ts", "foo.ts"]);
    assert.deepEqual(out.test_files, ["foo.test.ts"]);
    assert.equal(out.counts.test_files, 1);
  });

  it("a basename that merely starts with test is NOT a test file", () => {
    const out = build(["src/testfoo.ts", "src/testutils.ts", "test.ts"]);
    assert.deepEqual(out.test_files, []);
    assert.equal(out.counts.test_files, 0);
  });

  it(".test without a trailing dot does not match the basename clause", () => {
    const out = build(["src/foo.testdata.ts", "src/foo.tests.ts"]);
    assert.deepEqual(out.test_files, []);
  });
});

describe("buildOnboardMap — test-file detection: directory clause", () => {
  it("a directory segment exactly test makes a test file", () => {
    assert.deepEqual(build(["test/helper.ts"]).test_files, ["test/helper.ts"]);
  });

  it("a directory segment exactly tests makes a test file", () => {
    assert.deepEqual(build(["src/tests/util.ts"]).test_files, [
      "src/tests/util.ts",
    ]);
  });

  it("a directory segment exactly __tests__ makes a test file", () => {
    assert.deepEqual(build(["src/__tests__/a.ts"]).test_files, [
      "src/__tests__/a.ts",
    ]);
  });

  it("a directory segment exactly spec makes a test file", () => {
    assert.deepEqual(build(["spec/models/user.ts"]).test_files, [
      "spec/models/user.ts",
    ]);
  });

  it("a matching directory segment deep in the path counts", () => {
    assert.deepEqual(build(["a/b/tests/c/d.ts"]).test_files, [
      "a/b/tests/c/d.ts",
    ]);
  });

  it("a directory segment merely containing test does NOT count", () => {
    const out = build([
      "src/testing/foo.ts",
      "src/testdata/foo.ts",
      "src/latest/foo.ts",
      "src/contest/foo.ts",
    ]);
    assert.deepEqual(out.test_files, []);
  });

  it("the last segment is not a directory segment: a file named tests is not a test by that name alone", () => {
    const out = build(["src/tests", "src/test"]);
    assert.deepEqual(out.test_files, []);
  });

  it("test_files are sorted code-unit ascending regardless of input order", () => {
    const out = build([
      "z/b.test.ts",
      "a/c.test.ts",
      "M/d.test.ts",
      "a/a.spec.ts",
    ]);
    // Code-unit ascending: uppercase sorts before lowercase.
    assert.deepEqual(out.test_files, [
      "M/d.test.ts",
      "a/a.spec.ts",
      "a/c.test.ts",
      "z/b.test.ts",
    ]);
  });
});

describe("buildOnboardMap — areas", () => {
  it("area is the first path segment", () => {
    const out = build(["src/deep/nested/file.ts"]);
    assert.deepEqual(out.areas, [
      { area: "src", files: 1, tests: 0, entry_points: [], owners: [] },
    ]);
  });

  it("a path with no slash belongs to the (root) area", () => {
    const out = build(["README.md", "LICENSE"]);
    assert.deepEqual(out.areas, [
      { area: "(root)", files: 2, tests: 0, entry_points: [], owners: [] },
    ]);
    assert.equal(out.counts.areas, 1);
  });

  it("areas are sorted code-unit ascending by literal name, (root) by its characters", () => {
    const out = build(["zebra/a.ts", "Apple/b.ts", "rootfile.ts", "banana/c.ts"]);
    // "(" (40) sorts before uppercase (65) and lowercase (97+).
    assert.deepEqual(
      out.areas.map((a) => a.area),
      ["(root)", "Apple", "banana", "zebra"],
    );
  });

  it("area entries carry files, tests, entry_points, owners in the pinned key order", () => {
    const out = build(["src/a.ts"], {});
    assert.deepEqual(Object.keys(out.areas[0]), [
      "area",
      "files",
      "tests",
      "entry_points",
      "owners",
    ]);
  });

  it("per-area file and test counts are tallied independently", () => {
    const out = build([
      "src/a.ts",
      "src/a.test.ts",
      "src/b.spec.ts",
      "docs/guide.md",
      "docs/x.test.md",
    ]);
    const src = out.areas.find((a) => a.area === "src")!;
    const docs = out.areas.find((a) => a.area === "docs")!;
    assert.equal(src.files, 3);
    assert.equal(src.tests, 2);
    assert.equal(docs.files, 2);
    assert.equal(docs.tests, 1);
  });

  it("area entry_points follow input order of the entry_points list, not file order", () => {
    const out = build(["src/a.ts", "src/b.ts", "src/c.ts"], {
      entry_points: ["src/c.ts", "src/a.ts"],
    });
    const src = out.areas.find((a) => a.area === "src")!;
    assert.deepEqual(src.entry_points, ["src/c.ts", "src/a.ts"]);
  });

  it("a root entry point lands in the (root) area", () => {
    const out = build(["main.ts", "src/a.ts"], { entry_points: ["main.ts"] });
    const root = out.areas.find((a) => a.area === "(root)")!;
    assert.deepEqual(root.entry_points, ["main.ts"]);
  });

  it("area owners are the distinct owners of its files, sorted code-unit ascending", () => {
    const out = build(["src/a.ts", "src/sub/b.ts", "src/sub/c.ts", "src/d.ts"], {
      owners: { src: "carol", "src/sub": "Alice", "src/d.ts": "bob" },
    });
    const src = out.areas.find((a) => a.area === "src")!;
    // alice owns sub files, bob owns d.ts exactly, carol owns a.ts.
    assert.deepEqual(src.owners, ["Alice", "bob", "carol"]);
  });

  it("an area with no owned files has an empty owners list, not null", () => {
    const out = build(["docs/guide.md"]);
    assert.deepEqual(out.areas[0].owners, []);
  });
});

describe("buildOnboardMap — entry points", () => {
  it("found entry points echo in input order", () => {
    const out = build(["a.ts", "b.ts", "c.ts"], {
      entry_points: ["c.ts", "a.ts"],
    });
    assert.deepEqual(out.entry_points, ["c.ts", "a.ts"]);
    assert.deepEqual(out.missing_entry_points, []);
  });

  it("missing entry points are reported in input order, not an error", () => {
    const out = build(["src/a.ts"], {
      entry_points: ["src/main.ts", "src/a.ts", "gone.ts"],
    });
    assert.deepEqual(out.entry_points, ["src/a.ts"]);
    assert.deepEqual(out.missing_entry_points, ["src/main.ts", "gone.ts"]);
  });

  it("counts.entry_points counts only the found entry points", () => {
    const out = build(["a.ts"], { entry_points: ["a.ts", "b.ts", "c.ts"] });
    assert.equal(out.counts.entry_points, 1);
  });

  it("absent entry_points means empty found and missing lists", () => {
    const out = build(["a.ts"]);
    assert.deepEqual(out.entry_points, []);
    assert.deepEqual(out.missing_entry_points, []);
    assert.equal(out.counts.entry_points, 0);
  });

  it("an explicitly empty entry_points array behaves like absent", () => {
    const out = build(["a.ts"], { entry_points: [] });
    assert.deepEqual(out.entry_points, []);
    assert.deepEqual(out.missing_entry_points, []);
  });

  it("missing entry points do not appear in any area", () => {
    const out = build(["src/a.ts"], { entry_points: ["src/nope.ts"] });
    for (const area of out.areas) {
      assert.deepEqual(area.entry_points, []);
    }
  });
});

describe("buildOnboardMap — ownership matching", () => {
  it("clause 1: a key equal to the file path owns that exact file", () => {
    const out = build(["src/a.ts", "src/b.ts"], {
      owners: { "src/a.ts": "alice" },
    });
    assert.deepEqual(out.unowned_files, ["src/b.ts"]);
    const src = out.areas[0];
    assert.deepEqual(src.owners, ["alice"]);
  });

  it("clause 3: a key owns files under key + slash", () => {
    const out = build(["src/a.ts", "src/deep/b.ts"], {
      owners: { src: "alice" },
    });
    assert.deepEqual(out.unowned_files, []);
  });

  it("the slash boundary: src does NOT own srcfoo/a.ts", () => {
    const out = build(["srcfoo/a.ts", "src/a.ts"], {
      owners: { src: "alice" },
    });
    assert.deepEqual(out.unowned_files, ["srcfoo/a.ts"]);
  });

  it("clause 2: a trailing-slash key owns files starting with it", () => {
    const out = build(["src/a.ts", "src/deep/b.ts", "other/c.ts"], {
      owners: { "src/": "alice" },
    });
    assert.deepEqual(out.unowned_files, ["other/c.ts"]);
    assert.deepEqual(out.areas.find((a) => a.area === "src")!.owners, [
      "alice",
    ]);
  });

  it("longest-prefix wins when several keys match", () => {
    const out = build(["src/sub/deep.ts", "src/top.ts"], {
      owners: { src: "alice", "src/sub": "bob" },
    });
    assert.deepEqual(out.unowned_files, []);
    // Both owners appear for the src area: bob via the longer prefix.
    assert.deepEqual(out.areas[0].owners, ["alice", "bob"]);
    // Prove the longer key actually decided this file's owner: with only
    // the distinction visible per-area in a split layout:
    const out2 = build(["src/sub/deep.ts"], {
      owners: { src: "alice", "src/sub": "bob" },
    });
    assert.deepEqual(out2.areas[0].owners, ["bob"]);
  });

  it("longest wins across a trailing-slash key versus its bare twin", () => {
    const out = build(["src/a.ts"], {
      owners: { src: "alice", "src/": "bob" },
    });
    // "src/" (length 4) beats "src" (length 3) for src/a.ts.
    assert.deepEqual(out.areas[0].owners, ["bob"]);
  });

  it("longest wins over three nested prefixes", () => {
    const out = build(["a/b/c/file.ts"], {
      owners: { a: "one", "a/b": "two", "a/b/c": "three" },
    });
    assert.deepEqual(out.areas[0].owners, ["three"]);
    assert.deepEqual(out.unowned_files, []);
  });

  it("a file matched by no key is unowned", () => {
    const out = build(["x/a.ts", "y/b.ts"], { owners: { x: "alice" } });
    assert.deepEqual(out.unowned_files, ["y/b.ts"]);
    assert.equal(out.counts.unowned, 1);
  });

  it("absent owners means every file is unowned", () => {
    const out = build(["b.ts", "a/x.ts"]);
    assert.deepEqual(out.unowned_files, ["a/x.ts", "b.ts"]);
    assert.equal(out.counts.unowned, 2);
  });

  it("an explicitly empty owners object behaves like absent", () => {
    const out = build(["a.ts"], { owners: {} });
    assert.deepEqual(out.unowned_files, ["a.ts"]);
  });

  it("unowned_files are sorted code-unit ascending regardless of input order", () => {
    const out = build(["z/a.ts", "B/a.ts", "a/a.ts"], { owners: {} });
    assert.deepEqual(out.unowned_files, ["B/a.ts", "a/a.ts", "z/a.ts"]);
  });

  it("duplicate owners across files collapse to one distinct entry per area", () => {
    const out = build(["src/a.ts", "src/b.ts", "src/c.ts"], {
      owners: { src: "alice" },
    });
    assert.deepEqual(out.areas[0].owners, ["alice"]);
  });
});

describe("buildOnboardMap — test_command echo", () => {
  it("test_command echoes verbatim when present", () => {
    const out = build(["a.ts"], { test_command: "npm test -- --watch" });
    assert.equal(out.test_command, "npm test -- --watch");
  });

  it("test_command is null when absent", () => {
    const out = build(["a.ts"]);
    assert.equal(out.test_command, null);
  });

  it("an empty-string test_command is a string and echoes verbatim", () => {
    const out = build(["a.ts"], { test_command: "" });
    assert.equal(out.test_command, "");
  });
});

describe("buildOnboardMap — output shape and counts", () => {
  it("top-level keys are in the pinned order", () => {
    const out = build(["a.ts"]);
    assert.deepEqual(Object.keys(out), [
      "areas",
      "entry_points",
      "missing_entry_points",
      "test_files",
      "unowned_files",
      "test_command",
      "counts",
    ]);
  });

  it("counts keys are in the pinned order", () => {
    const out = build(["a.ts"]);
    assert.deepEqual(Object.keys(out.counts), [
      "files",
      "test_files",
      "areas",
      "entry_points",
      "unowned",
    ]);
  });

  it("a full hand-checked map", () => {
    const out = buildOnboardMap({
      files: [
        "README.md",
        "src/index.ts",
        "src/parser.ts",
        "src/parser.test.ts",
        "tests/helpers/setup.ts",
        "docs/guide.md",
      ],
      entry_points: ["src/index.ts", "src/main.ts"],
      test_command: "npm test",
      owners: { src: "alice", docs: "bob" },
    });
    assert.deepEqual(out, {
      areas: [
        { area: "(root)", files: 1, tests: 0, entry_points: [], owners: [] },
        {
          area: "docs",
          files: 1,
          tests: 0,
          entry_points: [],
          owners: ["bob"],
        },
        {
          area: "src",
          files: 3,
          tests: 1,
          entry_points: ["src/index.ts"],
          owners: ["alice"],
        },
        {
          area: "tests",
          files: 1,
          tests: 1,
          entry_points: [],
          owners: [],
        },
      ],
      entry_points: ["src/index.ts"],
      missing_entry_points: ["src/main.ts"],
      test_files: ["src/parser.test.ts", "tests/helpers/setup.ts"],
      unowned_files: ["README.md", "tests/helpers/setup.ts"],
      test_command: "npm test",
      counts: { files: 6, test_files: 2, areas: 4, entry_points: 1, unowned: 2 },
    });
  });

  it("a single root file gives minimal counts", () => {
    const out = build(["only.ts"]);
    assert.deepEqual(out.counts, {
      files: 1,
      test_files: 0,
      areas: 1,
      entry_points: 0,
      unowned: 1,
    });
    assert.equal(out.test_command, null);
  });
});

describe("buildOnboardMap — duplicate paths", () => {
  it("duplicate file paths are an error naming the duplicated path", () => {
    assert.throws(() => build(["a.ts", "b.ts", "a.ts"]), {
      message: "duplicate file path: a.ts",
    });
  });

  it("the error names the duplicated path when it appears later", () => {
    assert.throws(() => build(["x/a.ts", "y/b.ts", "y/b.ts"]), {
      message: "duplicate file path: y/b.ts",
    });
  });

  it("no partial result is produced on a duplicate", () => {
    assert.throws(() => build(["a.ts", "a.ts"]));
  });
});

describe("buildOnboardMap — validation", () => {
  const throws = (args: unknown, message: string) =>
    assert.throws(() => buildOnboardMap(args), { message });

  it("files missing is an error naming files", () => {
    throws({}, "files is required");
    throws({ entry_points: [] }, "files is required");
  });

  it("a non-object top-level argument is treated as {} and fails on files", () => {
    throws(null, "files is required");
    throws([], "files is required");
    throws("x", "files is required");
    throws(42, "files is required");
    throws(undefined, "files is required");
  });

  it("files not an array or empty names files", () => {
    throws({ files: "x" }, "files must be a non-empty array");
    throws({ files: {} }, "files must be a non-empty array");
    throws({ files: 3 }, "files must be a non-empty array");
    throws({ files: [] }, "files must be a non-empty array");
    throws({ files: null }, "files must be a non-empty array");
  });

  it("a files entry non-string or empty names its index (spec example shape)", () => {
    throws({ files: ["a.ts", "b.ts", 42] }, "files[2] must be a non-empty string");
    throws({ files: [""] }, "files[0] must be a non-empty string");
    throws({ files: ["a.ts", ""] }, "files[1] must be a non-empty string");
    throws({ files: [null] }, "files[0] must be a non-empty string");
    throws({ files: [[]] }, "files[0] must be a non-empty string");
    throws({ files: [true] }, "files[0] must be a non-empty string");
  });

  it("entry_points present but not an array names entry_points", () => {
    throws({ files: ["a.ts"], entry_points: "a.ts" }, "entry_points must be an array");
    throws({ files: ["a.ts"], entry_points: {} }, "entry_points must be an array");
    throws({ files: ["a.ts"], entry_points: 7 }, "entry_points must be an array");
    throws({ files: ["a.ts"], entry_points: null }, "entry_points must be an array");
  });

  it("an entry_points entry non-string or empty names its index", () => {
    throws(
      { files: ["a.ts"], entry_points: ["a.ts", ""] },
      "entry_points[1] must be a non-empty string",
    );
    throws(
      { files: ["a.ts"], entry_points: [42] },
      "entry_points[0] must be a non-empty string",
    );
    throws(
      { files: ["a.ts"], entry_points: [null] },
      "entry_points[0] must be a non-empty string",
    );
  });

  it("test_command present but not a string names test_command", () => {
    for (const bad of [42, true, null, [], {}]) {
      throws(
        { files: ["a.ts"], test_command: bad },
        "test_command must be a string",
      );
    }
  });

  it("owners present but not an object names owners", () => {
    throws({ files: ["a.ts"], owners: "alice" }, "owners must be an object");
    throws({ files: ["a.ts"], owners: [] }, "owners must be an object");
    throws({ files: ["a.ts"], owners: 42 }, "owners must be an object");
    throws({ files: ["a.ts"], owners: null }, "owners must be an object");
    throws({ files: ["a.ts"], owners: true }, "owners must be an object");
  });

  it("an owners empty key names the owners key", () => {
    throws(
      { files: ["a.ts"], owners: { "": "alice" } },
      "owners key must be a non-empty string",
    );
  });

  it("an owners value non-string or empty names the key", () => {
    throws(
      { files: ["a.ts"], owners: { src: "" } },
      'owners["src"] must be a non-empty string',
    );
    throws(
      { files: ["a.ts"], owners: { src: 42 } },
      'owners["src"] must be a non-empty string',
    );
    throws(
      { files: ["a.ts"], owners: { "src/sub": null } },
      'owners["src/sub"] must be a non-empty string',
    );
    throws(
      { files: ["a.ts"], owners: { src: [] } },
      'owners["src"] must be a non-empty string',
    );
  });

  it("unknown extra fields are ignored", () => {
    const out = buildOnboardMap({
      files: ["a.ts"],
      generated_by: "test",
      extra: { nested: true },
    });
    assert.equal(out.counts.files, 1);
    assert.deepEqual(out.areas[0].area, "(root)");
  });

  it("no partial result is produced on invalid input deep in the list", () => {
    assert.throws(() =>
      buildOnboardMap({
        files: ["a.ts", "b.ts", ""],
        entry_points: ["a.ts"],
        owners: { a: "alice" },
      }),
    );
  });
});
