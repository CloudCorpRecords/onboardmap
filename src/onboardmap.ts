/**
 * onboardmap core: build a newcomer map from
 * caller-supplied repository facts.
 *
 *   buildOnboardMap(args) -> { areas, entry_points,
 *     missing_entry_points, test_files, unowned_files,
 *     test_command, counts }
 *
 * Test files (pinned): a file is a test file when its
 * basename (the segment after the last "/") contains
 * ".test." or ".spec.", OR any directory segment (every
 * segment except the last) is exactly "test", "tests",
 * "__tests__", or "spec". A basename that merely starts
 * with "test" matches neither clause and is not a test
 * file.
 *
 * Areas (pinned): a file's area is its first path
 * segment, or the literal "(root)" when the path contains
 * no "/". Areas are sorted code-unit ascending by area
 * name. Each area entry is {area, files, tests,
 * entry_points, owners} in that key order.
 *
 * Ownership (pinned): an owners key K matches a file F
 * when F === K, or K ends with "/" and F starts with K,
 * or F starts with K + "/". When several keys match, the
 * longest key wins. A file matched by no key is unowned.
 *
 * Entry points that do not appear in `files` are not an
 * error: they are reported under missing_entry_points in
 * input order. Entry points that do appear are echoed
 * under entry_points in input order. test_files and
 * unowned_files are sorted code-unit ascending.
 * test_command echoes verbatim, or is null when absent;
 * an empty string is a string and echoes verbatim.
 *
 * counts is {files, test_files, areas, entry_points,
 * unowned} in that key order; its entry_points counts
 * the entry points found in files.
 *
 * Validation is strict and path-naming: any malformed
 * input throws an Error naming the offending path and no
 * partial result is produced. Duplicate file paths throw
 * "duplicate file path: X". Unknown extra fields are
 * ignored; a non-object top-level argument is treated
 * as {}.
 */
import type {
  AreaEntry,
  OnboardCounts,
  OnboardMapResult,
} from "./types.js";

export const VERSION = "0.1.0";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const TEST_DIR_SEGMENTS = new Set(["test", "tests", "__tests__", "spec"]);

function isTestFile(path: string): boolean {
  const segments = path.split("/");
  const basename = segments[segments.length - 1];
  if (basename.includes(".test.") || basename.includes(".spec.")) {
    return true;
  }
  for (let i = 0; i < segments.length - 1; i++) {
    if (TEST_DIR_SEGMENTS.has(segments[i])) return true;
  }
  return false;
}

function areaOf(path: string): string {
  const idx = path.indexOf("/");
  return idx === -1 ? "(root)" : path.slice(0, idx);
}

function ownerOf(
  file: string,
  ownerEntries: [string, string][],
): string | null {
  let bestLen = -1;
  let bestOwner: string | null = null;
  for (const [key, owner] of ownerEntries) {
    const matches =
      file === key ||
      (key.endsWith("/") && file.startsWith(key)) ||
      file.startsWith(key + "/");
    if (matches && key.length > bestLen) {
      bestLen = key.length;
      bestOwner = owner;
    }
  }
  return bestOwner;
}

/** Build a newcomer map from supplied repository facts. */
export function buildOnboardMap(args: unknown): OnboardMapResult {
  const raw: Record<string, unknown> = isRecord(args) ? args : {};

  if (raw.files === undefined) throw new Error("files is required");
  if (!Array.isArray(raw.files) || raw.files.length === 0) {
    throw new Error("files must be a non-empty array");
  }
  const files: string[] = raw.files.map((entry, i) => {
    if (typeof entry !== "string" || entry.length === 0) {
      throw new Error(`files[${i}] must be a non-empty string`);
    }
    return entry;
  });

  const seen = new Set<string>();
  for (const f of files) {
    if (seen.has(f)) {
      throw new Error(`duplicate file path: ${f}`);
    }
    seen.add(f);
  }

  let entryPoints: string[] = [];
  if (raw.entry_points !== undefined) {
    if (!Array.isArray(raw.entry_points)) {
      throw new Error("entry_points must be an array");
    }
    entryPoints = raw.entry_points.map((entry, i) => {
      if (typeof entry !== "string" || entry.length === 0) {
        throw new Error(`entry_points[${i}] must be a non-empty string`);
      }
      return entry;
    });
  }

  let testCommand: string | null = null;
  if (raw.test_command !== undefined) {
    if (typeof raw.test_command !== "string") {
      throw new Error("test_command must be a string");
    }
    testCommand = raw.test_command;
  }

  let ownerEntries: [string, string][] = [];
  if (raw.owners !== undefined) {
    if (!isRecord(raw.owners)) {
      throw new Error("owners must be an object");
    }
    for (const [key, value] of Object.entries(raw.owners)) {
      if (key.length === 0) {
        throw new Error("owners key must be a non-empty string");
      }
      if (typeof value !== "string" || value.length === 0) {
        throw new Error(
          `owners[${JSON.stringify(key)}] must be a non-empty string`,
        );
      }
      ownerEntries.push([key, value]);
    }
  }

  const fileSet = new Set(files);
  const foundEntryPoints = entryPoints.filter((p) => fileSet.has(p));
  const missingEntryPoints = entryPoints.filter((p) => !fileSet.has(p));

  const testFiles = files.filter((f) => isTestFile(f)).sort();

  const ownerByFile = new Map<string, string | null>();
  for (const f of files) {
    ownerByFile.set(f, ownerOf(f, ownerEntries));
  }
  const unownedFiles = files
    .filter((f) => ownerByFile.get(f) === null)
    .sort();

  interface AreaAcc {
    files: number;
    tests: number;
    entry_points: string[];
    owners: Set<string>;
  }
  const areaMap = new Map<string, AreaAcc>();
  for (const f of files) {
    const area = areaOf(f);
    let acc = areaMap.get(area);
    if (!acc) {
      acc = { files: 0, tests: 0, entry_points: [], owners: new Set() };
      areaMap.set(area, acc);
    }
    acc.files += 1;
    if (isTestFile(f)) acc.tests += 1;
    const owner = ownerByFile.get(f);
    if (owner !== null && owner !== undefined) acc.owners.add(owner);
  }
  for (const ep of foundEntryPoints) {
    const acc = areaMap.get(areaOf(ep));
    if (acc) acc.entry_points.push(ep);
  }

  const areas: AreaEntry[] = [...areaMap.keys()].sort().map((area) => {
    const acc = areaMap.get(area)!;
    return {
      area,
      files: acc.files,
      tests: acc.tests,
      entry_points: acc.entry_points,
      owners: [...acc.owners].sort(),
    };
  });

  const counts: OnboardCounts = {
    files: files.length,
    test_files: testFiles.length,
    areas: areas.length,
    entry_points: foundEntryPoints.length,
    unowned: unownedFiles.length,
  };

  return {
    areas,
    entry_points: foundEntryPoints,
    missing_entry_points: missingEntryPoints,
    test_files: testFiles,
    unowned_files: unownedFiles,
    test_command: testCommand,
    counts,
  };
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
