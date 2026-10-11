/**
 * fetch-repo.ts — download a public GitHub repository archive and extract it.
 *
 * No GitHub token is requested or stored. The archive endpoint is public for
 * any public repository. We fetch the tarball for the default branch HEAD,
 * which gives us the commit SHA from the redirect URL or the response headers.
 *
 * The system `tar` binary handles extraction — no npm package dependency.
 * Caller is responsible for cleaning up the tmp directory when done.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { exec } from "child_process";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface FetchResult {
  /** Path to the extracted repository root directory */
  extractedPath: string;
  /** Temporary directory that contains the extraction — delete when done */
  tmpDir: string;
  /** Full commit SHA from the archive, e.g. "abc123def456..." */
  commitSha: string;
}

/**
 * Parse a GitHub URL into owner and repo name.
 * Accepts https://github.com/owner/repo and https://github.com/owner/repo.git
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  let cleaned = url.trim();
  // Strip trailing slash and .git suffix
  cleaned = cleaned.replace(/\.git$/, "").replace(/\/$/, "");

  const match = cleaned.match(
    /^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/,
  );
  if (!match) {
    throw new Error(
      `Not a valid GitHub repository URL: ${url}. ` +
      `Expected https://github.com/owner/repo`,
    );
  }
  return { owner: match[1], repo: match[2] };
}

/**
 * Download and extract a public GitHub repository.
 *
 * GitHub's archive URL for the default branch:
 *   https://github.com/{owner}/{repo}/archive/HEAD.tar.gz
 *
 * GitHub redirects to a URL that includes the commit SHA in the path, e.g.:
 *   https://codeload.github.com/{owner}/{repo}/tar.gz/{sha}
 *
 * We capture the final URL after redirects to extract the commit SHA.
 */
export async function fetchRepo(repoUrl: string): Promise<FetchResult> {
  const { owner, repo } = parseGitHubUrl(repoUrl);

  const archiveUrl = `https://github.com/${owner}/${repo}/archive/HEAD.tar.gz`;

  // Create an isolated tmp directory for this fetch
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `cartograph-${repo}-`));
  const tarPath = path.join(tmpDir, "archive.tar.gz");

  // Fetch the archive. Node 18+ has native fetch; we follow redirects to
  // capture the final URL which contains the commit SHA.
  let response: Response;

  try {
    response = await fetch(archiveUrl, {
      redirect: "follow",
      // cache: no-store opts out of Next.js's fetch cache, which buffers the
      // entire response body as a string and hits Node's string length limit
      // on archives larger than ~500 MB. We stream to disk instead.
      cache: "no-store",
      headers: {
        "User-Agent": "cartograph/1 (public-repo-mapper)",
      },
    });
  } catch (err) {
    cleanup(tmpDir);
    throw new Error(`Network error fetching ${archiveUrl}: ${err}`);
  }

  if (!response.ok) {
    cleanup(tmpDir);
    if (response.status === 404) {
      throw new Error(
        `Repository not found: ${repoUrl}. Check the URL is correct and the repository is public.`,
      );
    }
    throw new Error(
      `GitHub returned ${response.status} ${response.statusText} for ${archiveUrl}`,
    );
  }

  // response.url is the final URL after all redirects
  const finalUrl = response.url;

  // Stream the response body directly to disk — never materialise it in memory.
  // response.arrayBuffer() pulls the whole tarball into a JS string internally,
  // which hits Node's ERR_STRING_TOO_LONG on repos larger than ~512 MB.
  if (!response.body) {
    cleanup(tmpDir);
    throw new Error("Response had no body");
  }
  const fileStream = fs.createWriteStream(tarPath);
  await pipeline(Readable.fromWeb(response.body as import("stream/web").ReadableStream), fileStream);

  // Extract the SHA from the final URL.
  // GitHub's codeload URL looks like: /tar.gz/<sha> or /<sha>.tar.gz
  // Fallback: use "unknown" and let the caller decide.
  const commitSha = extractShaFromUrl(finalUrl);

  // Extract the tarball using the system tar binary.
  // GitHub archives have a single top-level directory: {repo}-{sha}/
  // Strip the first path component so we get the repo root directly.
  try {
    await execAsync(`tar -xzf "${tarPath}" -C "${tmpDir}" --strip-components=1`);
  } catch (err) {
    cleanup(tmpDir);
    throw new Error(`Failed to extract archive: ${err}`);
  }

  // Remove the tarball now that it's extracted — no need to hold two copies
  fs.unlinkSync(tarPath);

  // The extracted content is directly in tmpDir (strip-components=1 removed
  // the outer {repo}-{sha}/ directory)
  return { extractedPath: tmpDir, tmpDir, commitSha };
}

/**
 * Extract a full commit SHA from a GitHub redirect URL.
 * The codeload URL is: https://codeload.github.com/owner/repo/tar.gz/<sha>
 * The legacy URL is:   https://github.com/owner/repo/archive/<sha>.tar.gz
 */
function extractShaFromUrl(url: string): string {
  // codeload: ends in /tar.gz/<40-char-sha>
  const codeloadMatch = url.match(/\/tar\.gz\/([0-9a-f]{40})$/);
  if (codeloadMatch) return codeloadMatch[1];

  // archive path: /<sha>.tar.gz
  const archiveMatch = url.match(/\/([0-9a-f]{40})\.tar\.gz$/);
  if (archiveMatch) return archiveMatch[1];

  // Short SHAs or branch names also appear — capture anything after tar.gz/
  const anyMatch = url.match(/\/tar\.gz\/([^/]+)$/);
  if (anyMatch) return anyMatch[1];

  return "unknown";
}

/** Delete a directory tree silently — used for cleanup on error paths. */
export function cleanup(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Best effort. If this fails the OS will clean /tmp eventually.
  }
}
