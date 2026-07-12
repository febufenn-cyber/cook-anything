import { createHash } from "node:crypto";

interface CandidateResponse {
  id: string;
  submissionId: string;
  versionId: string;
  contentHash: string;
  canonicalSlug: string;
  candidateJson: Record<string, unknown>;
  status: "claimed";
  createdAt: string;
}

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
};

const supabaseUrl = required("SUPABASE_URL").replace(/\/+$/, "");
const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
const githubToken = required("GITHUB_TOKEN");
const repository = required("GITHUB_REPOSITORY");
const candidateId = required("PUBLICATION_CANDIDATE_ID");
const baseBranch = process.env.PUBLICATION_BASE_BRANCH?.trim() || "main";
const allowlist = new Set((process.env.PUBLICATION_REPOSITORY_ALLOWLIST || "febufenn-cyber/cook-anything").split(",").map((item) => item.trim()).filter(Boolean));

if (!allowlist.has(repository)) throw new Error("publication_repository_not_allowlisted");
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("invalid_github_repository");
if (!/^[0-9a-f-]{20,100}$/i.test(candidateId)) throw new Error("invalid_publication_candidate_id");
if (!/^[A-Za-z0-9._/-]{1,120}$/.test(baseBranch) || baseBranch.includes("..")) throw new Error("invalid_base_branch");

async function responseJson(response: Response): Promise<unknown> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`request_failed_${response.status}:${JSON.stringify(body).slice(0, 500)}`);
  return body;
}

async function supabaseRpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error("invalid_rpc_name");
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return await responseJson(response) as T;
}

async function github<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith("/")) throw new Error("invalid_github_path");
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${githubToken}`,
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  return await responseJson(response) as T;
}

function validateCandidate(value: unknown): CandidateResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_candidate_response");
  const candidate = value as Partial<CandidateResponse>;
  // The hardened claim RPC atomically transitions ready -> claimed before returning.
  if (candidate.status !== "claimed") throw new Error("publication_candidate_not_claimed");
  if (typeof candidate.id !== "string" || candidate.id !== candidateId) throw new Error("publication_candidate_identity_mismatch");
  if (typeof candidate.contentHash !== "string" || !/^[a-f0-9]{64}$/.test(candidate.contentHash)) throw new Error("invalid_candidate_hash");
  if (typeof candidate.canonicalSlug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.canonicalSlug)) throw new Error("invalid_candidate_slug");
  if (!candidate.candidateJson || typeof candidate.candidateJson !== "object" || Array.isArray(candidate.candidateJson)) throw new Error("invalid_candidate_json");
  const embeddedHash = (candidate.candidateJson as Record<string, unknown>).contentHash;
  if (embeddedHash !== candidate.contentHash) throw new Error("candidate_hash_mismatch");
  return candidate as CandidateResponse;
}

async function main(): Promise<void> {
  const rawClaim = await supabaseRpc<unknown>("claim_publication_candidate", { p_candidate_id: candidateId });
  const candidate = validateCandidate(rawClaim);
  // Single-use claim token (returned exactly once): required to record the PR,
  // so a second worker or an expired claim can never attach a duplicate PR.
  const claimToken = (rawClaim as Record<string, unknown>)?.claimToken;
  if (typeof claimToken !== "string" || claimToken.length < 32) throw new Error("missing_claim_token");
  const [owner, repo] = repository.split("/");
  const short = candidate.id.replace(/-/g, "").slice(0, 10);
  const branch = `contribution/${candidate.canonicalSlug}-${short}`;
  const candidatePath = `quarantine/publication-candidates/${candidate.canonicalSlug}-${short}.json`;
  const evidencePath = `quarantine/publication-candidates/${candidate.canonicalSlug}-${short}.evidence.json`;

  const ref = await github<{ object: { sha: string } }>(`/git/ref/heads/${encodeURIComponent(baseBranch)}`);
  const baseCommit = await github<{ tree: { sha: string } }>(`/git/commits/${ref.object.sha}`);
  await github("/git/refs", { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: ref.object.sha }) });

  const candidateFile = JSON.stringify({
    quarantineStatus: "publication_candidate_not_yet_public",
    instructions: [
      "Do not move this file into data/recipes until all canonical fields are editorially completed.",
      "Preserve the submitted content hash and rights evidence.",
      "Run the complete recipe trust, duplicate and build gates before making this PR ready.",
    ],
    candidate: candidate.candidateJson,
  }, null, 2) + "\n";
  const evidenceFile = JSON.stringify({
    candidateId: candidate.id,
    submissionId: candidate.submissionId,
    versionId: candidate.versionId,
    contentHash: candidate.contentHash,
    canonicalSlug: candidate.canonicalSlug,
    claimedAt: new Date().toISOString(),
    candidateSha256: createHash("sha256").update(candidateFile).digest("hex"),
    publicationBoundary: "quarantine-first-github-pr-no-auto-merge",
  }, null, 2) + "\n";

  const [candidateBlob, evidenceBlob] = await Promise.all([
    github<{ sha: string }>("/git/blobs", { method: "POST", body: JSON.stringify({ content: candidateFile, encoding: "utf-8" }) }),
    github<{ sha: string }>("/git/blobs", { method: "POST", body: JSON.stringify({ content: evidenceFile, encoding: "utf-8" }) }),
  ]);
  const tree = await github<{ sha: string }>("/git/trees", {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseCommit.tree.sha,
      tree: [
        { path: candidatePath, mode: "100644", type: "blob", sha: candidateBlob.sha },
        { path: evidencePath, mode: "100644", type: "blob", sha: evidenceBlob.sha },
      ],
    }),
  });
  const commit = await github<{ sha: string }>("/git/commits", {
    method: "POST",
    body: JSON.stringify({
      message: `Quarantine publication candidate: ${candidate.canonicalSlug}`,
      tree: tree.sha,
      parents: [ref.object.sha],
    }),
  });
  await github(`/git/refs/heads/${branch.replaceAll("/", "%2F")}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) });
  const pull = await github<{ html_url: string }>("/pulls", {
    method: "POST",
    body: JSON.stringify({
      title: `Recipe candidate: ${candidate.canonicalSlug}`,
      head: branch,
      base: baseBranch,
      draft: true,
      body: [
        "## Quarantined publication candidate",
        "",
        `Submission: \`${candidate.submissionId}\``,
        `Immutable content hash: \`${candidate.contentHash}\``,
        "",
        "This PR is intentionally not publication-ready. Complete canonical recipe metadata, independently review the rights/trust evidence, move the final batch into `data/recipes/`, remove the quarantine files, and require the complete trust gate before review readiness.",
        "",
        "This operator has no merge or deploy capability.",
      ].join("\n"),
    }),
  });
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/[0-9]+$/.test(pull.html_url)) throw new Error("invalid_created_pr_url");
  await supabaseRpc("mark_publication_candidate_pr", { p_candidate_id: candidate.id, p_github_pr_url: pull.html_url, p_claim_token: claimToken });
  console.log(JSON.stringify({ ok: true, branch, pullRequest: pull.html_url, candidatePath, evidencePath }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
