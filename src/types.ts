/**
 * onboardmap types.
 *
 * onboardmap builds a newcomer map from caller-supplied
 * repository facts only. For a repository the caller
 * supplies its file paths, optionally the paths it names
 * as entry points, optionally the command that runs the
 * test suite, and optionally a map from path prefix to
 * owner name. From that data alone, as pure local
 * computation, onboardmap reports:
 *
 *   - one entry per area: how many files and test files
 *     it holds, which entry points live in it, and who
 *     owns its files
 *   - the entry points found in the file list and the
 *     ones that were named but are missing from it
 *   - every test file and every unowned file
 *   - the test command, echoed verbatim or null
 *   - counts of files, test files, areas, found entry
 *     points, and unowned files
 *
 * A file's area is its first path segment, or the literal
 * "(root)" when the path contains no "/". A file is a test
 * file when its basename contains ".test." or ".spec.",
 * or any directory segment is exactly "test", "tests",
 * "__tests__", or "spec". No repository is ever read.
 */

/** One area of the repository in the newcomer map. */
export interface AreaEntry {
  /** Area name: the first path segment, or "(root)". */
  area: string;
  /** Number of files in the area. */
  files: number;
  /** Number of test files in the area. */
  tests: number;
  /** The area's entry-point paths, in input order. */
  entry_points: string[];
  /** Distinct owners of the area's files, sorted code-unit ascending. */
  owners: string[];
}

/** Tallies for the newcomer map. */
export interface OnboardCounts {
  /** Total number of files supplied. */
  files: number;
  /** Number of test files found. */
  test_files: number;
  /** Number of distinct areas. */
  areas: number;
  /** Number of entry points found in the file list. */
  entry_points: number;
  /** Number of files matched by no owner prefix. */
  unowned: number;
}

/** The full newcomer map. */
export interface OnboardMapResult {
  /** One entry per area, sorted code-unit ascending by area name. */
  areas: AreaEntry[];
  /** Entry points that appear in the file list, in input order. */
  entry_points: string[];
  /** Entry points absent from the file list, in input order. */
  missing_entry_points: string[];
  /** Every test file path, sorted code-unit ascending. */
  test_files: string[];
  /** Every unowned file path, sorted code-unit ascending. */
  unowned_files: string[];
  /** The test command echoed verbatim, or null when absent. */
  test_command: string | null;
  /** Tallies for the map. */
  counts: OnboardCounts;
}
