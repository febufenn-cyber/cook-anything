#!/usr/bin/env node
/**
 * Publication operator: GitHub-side crash-resumption tests.
 *
 * Runs the REAL operator (scripts/open-publication-candidate-pr.ts) against a
 * dedicated STAGING GitHub repository and a live Supabase stack, injecting
 * crashes after each GitHub side effect (branch / commit / PR) via
 * OPERATOR_CRASH_AFTER, then proving a later worker resumes without duplicate
 * branches or PRs and refuses unrelated branches.
 *
 * Credential-gated: exits 0 with SKIP unless SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, PGEXEC, GITHUB_TOKEN and STAGING_PUB_REPO are set.
 * Never points at the production repository.
 */
import assert from "node:assert/strict";
import { execSync, spawnSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PGEXEC, GITHUB_TOKEN, STAGING_PUB_REPO } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PGEXEC || !GITHUB_TOKEN || !STAGING_PUB_REPO) {
  console.log("SKIP operator resumption tests: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/PGEXEC/GITHUB_TOKEN/STAGING_PUB_REPO required.");
  process.exit(0);
}
assert.notEqual(STAGING_PUB_REPO, "febufenn-cyber/cook-anything", "never run against the production repository");

const sql = (q) => execSync(`${PGEXEC} ${JSON.stringify(q.replace(/\s+/g, " ").trim())}`).toString().trim().split("\n")[0].trim();
const gh = (args) => {
  const out = execSync(`gh api ${args}`, { env: { ...process.env, GH_TOKEN: GITHUB_TOKEN } }).toString().trim();
  try { return JSON.parse(out || "null"); } catch { return out; }
};

async function makeCandidate(tag) {
  const admin = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ email: `op-${tag}-${randomUUID().slice(0, 6)}@test.local`, password: `pw-${randomUUID()}`, email_confirm: true }),
  });
  const userId = (await admin.json()).id;
  const hash = createHash("sha256").update(randomUUID()).digest("hex");
  const slug = `op-${tag}-${randomUUID().slice(0, 6)}`;
  const id = sql(`
    with d as (insert into recipe_drafts (owner_id, scope_type, scope_id, title, status)
      values ('${userId}', 'personal', '${userId}', 'Operator test', 'ready_for_submission') returning id),
    v as (insert into recipe_draft_versions (draft_id, version_number, content_hash, content, created_by)
      select id, 1, '${hash}', '{"title":"Operator test"}'::jsonb, '${userId}' from d returning id, draft_id),
    s as (insert into recipe_submissions (draft_id, version_id, content_hash, status, contributor_id)
      select draft_id, id, '${hash}', 'publication_candidate', '${userId}' from v returning id, version_id)
    insert into publication_candidates (submission_id, version_id, content_hash, canonical_slug, candidate_json, status, created_by)
    select id, version_id, '${hash}', '${slug}', jsonb_build_object('contentHash', '${hash}'), 'ready', '${userId}' from s returning id;`);
  assert.match(id, /^[0-9a-f-]{36}$/);
  return { id, slug, hash, branch: `contribution/${slug}-${id.replace(/-/g, "").slice(0, 10)}` };
}

function runOperator(candidateId, crashAfter) {
  return spawnSync("npx", ["tsx", "scripts/open-publication-candidate-pr.ts"], {
    env: {
      ...process.env,
      GITHUB_REPOSITORY: STAGING_PUB_REPO,
      PUBLICATION_REPOSITORY_ALLOWLIST: STAGING_PUB_REPO,
      PUBLICATION_CANDIDATE_ID: candidateId,
      OPERATOR_CRASH_AFTER: crashAfter ?? "",
    },
    encoding: "utf8",
  });
}

const expireClaim = (id) => sql(`update publication_candidates set claim_expires_at = now() - interval '1 minute' where id='${id}'`);
const prsForBranch = (branch) => gh(`"repos/${STAGING_PUB_REPO}/pulls?head=${STAGING_PUB_REPO.split("/")[0]}:${branch}&state=all" --jq '[.[] | {url: .html_url, draft: .draft, state: .state}]'`);
const candidateStatus = (id) => sql(`select status||':'||coalesce(github_pr_url,'-') from publication_candidates where id='${id}'`);

// --- Scenario 1: crash after branch creation, resume ------------------------
{
  const c = await makeCandidate("branchcrash");
  const crashed = runOperator(c.id, "create_branch");
  assert.equal(crashed.status, 3, `expected injected crash, got ${crashed.status}: ${crashed.stderr}`);
  assert.equal(prsForBranch(c.branch).length, 0, "no PR after branch-stage crash");
  expireClaim(c.id);
  const resumed = runOperator(c.id, null);
  assert.equal(resumed.status, 0, `resume failed: ${resumed.stderr}`);
  const prs = prsForBranch(c.branch);
  assert.equal(prs.length, 1, "exactly one PR after resume");
  assert.equal(prs[0].draft, true, "PR is draft");
  assert.match(candidateStatus(c.id), /^pr_open:https/, "candidate recorded");
  console.log("PASS crash-after-branch: resumed on empty branch, single draft PR, recorded");
}

// --- Scenario 2: crash after commit creation, resume ------------------------
{
  const c = await makeCandidate("commitcrash");
  const crashed = runOperator(c.id, "create_commit");
  assert.equal(crashed.status, 3);
  expireClaim(c.id);
  const resumed = runOperator(c.id, null);
  assert.equal(resumed.status, 0, `resume failed: ${resumed.stderr}`);
  const prs = prsForBranch(c.branch);
  assert.equal(prs.length, 1, "exactly one PR; committed branch reused without new commit");
  assert.match(candidateStatus(c.id), /^pr_open:https/);
  console.log("PASS crash-after-commit: verified existing commit reused, single draft PR, recorded");
}

// --- Scenario 3: crash after PR creation (before recording), resume ---------
{
  const c = await makeCandidate("prcrash");
  const crashed = runOperator(c.id, "create_pr");
  assert.equal(crashed.status, 3);
  assert.equal(prsForBranch(c.branch).length, 1, "PR exists but is unrecorded");
  assert.match(candidateStatus(c.id), /^claimed:/, "candidate still claimed, not recorded");
  expireClaim(c.id);
  const resumed = runOperator(c.id, null);
  assert.equal(resumed.status, 0, `resume failed: ${resumed.stderr}`);
  assert.equal(prsForBranch(c.branch).length, 1, "NO duplicate PR on resume");
  assert.match(candidateStatus(c.id), /^pr_open:https/, "existing PR recorded");
  console.log("PASS crash-after-pr: existing PR adopted, no duplicate, recorded");
}

// --- Scenario 4: unrelated branch with same name is refused ------------------
{
  const c = await makeCandidate("foreign");
  const base = gh(`repos/${STAGING_PUB_REPO}/git/ref/heads/main --jq '{sha: .object.sha}'`);
  gh(`-X POST repos/${STAGING_PUB_REPO}/git/refs -f ref="refs/heads/${c.branch}" -f sha="${base.sha}" --jq '.ref'`);
  gh(`-X PUT repos/${STAGING_PUB_REPO}/contents/unrelated.txt -f message="foreign work" -f branch="${c.branch}" -f content="Zm9yZWlnbg==" --jq '.commit.sha'`);
  const refused = runOperator(c.id, null);
  assert.equal(refused.status, 1, "operator must fail on foreign branch");
  assert.match(refused.stderr + refused.stdout, /existing_unrelated_branch_refused/, "explicit refusal reason");
  assert.equal(prsForBranch(c.branch).length, 0, "no PR opened over foreign branch");
  console.log("PASS unrelated-branch: refused, nothing overwritten, no PR");
}

// --- Scenario 5: allowlist enforcement ---------------------------------------
{
  const c = await makeCandidate("allowlist");
  const out = spawnSync("npx", ["tsx", "scripts/open-publication-candidate-pr.ts"], {
    env: { ...process.env, GITHUB_REPOSITORY: "febufenn-cyber/not-allowed", PUBLICATION_REPOSITORY_ALLOWLIST: STAGING_PUB_REPO, PUBLICATION_CANDIDATE_ID: c.id },
    encoding: "utf8",
  });
  assert.equal(out.status, 1);
  assert.match(out.stderr + out.stdout, /publication_repository_not_allowlisted/);
  console.log("PASS allowlist: non-allowlisted repository refused before any side effect");
}

console.log("Publication-operator crash-resumption tests passed.");
