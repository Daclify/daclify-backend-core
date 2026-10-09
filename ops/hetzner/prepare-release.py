#!/usr/bin/python3
"""Prepare separate pinned worktrees; never select a release or start an API."""
import json
import pathlib
import re
import subprocess
import sys

CORE = pathlib.Path("/data/daclify-backend-core")
MODULES = pathlib.Path("/data/daclify-backend-modules")
RELEASES = pathlib.Path("/data/daclify-api")
BRANCHES = {"mainnet": "main", "testnet": "dev"}


def git(repo, *arguments):
    return subprocess.run(["git", "-C", str(repo), *arguments], check=True,
                          capture_output=True, text=True).stdout.strip()


def prepare(environment, module_commit):
    if environment not in BRANCHES or not re.fullmatch(r"[0-9a-f]{40}", module_commit):
        raise ValueError("Usage: prepare-release.py mainnet|testnet MODULES_COMMIT_SHA")
    branch = BRANCHES[environment]
    try:
        git(CORE, "fetch", "--no-tags", "origin", f"refs/heads/{branch}:refs/remotes/origin/{branch}")
    except subprocess.CalledProcessError:
        raise ValueError("BRANCH_FETCH_FAILED:" + branch) from None
    core_commit = git(CORE, "rev-parse", "refs/remotes/origin/" + branch)
    try:
        git(CORE, "cat-file", "-e", core_commit + ":tools/host/preflight.ts")
        bootstrap = git(CORE, "show", core_commit + ":tools/bootstrap.ts")
        if "--backend-only" not in bootstrap:
            raise ValueError("COMMIT_DEPLOYMENT_TOOLS_TO_SELECTED_BRANCH_FIRST")
    except subprocess.CalledProcessError:
        raise ValueError("COMMIT_DEPLOYMENT_TOOLS_TO_SELECTED_BRANCH_FIRST") from None
    git(MODULES, "fetch", "--no-tags", "origin", module_commit)
    if git(MODULES, "rev-parse", module_commit + "^{commit}") != module_commit:
        raise ValueError("INVALID_MODULES_COMMIT")
    release = RELEASES / environment / "releases" / (core_commit + "-" + module_commit)
    release.mkdir(parents=True, exist_ok=False)
    # Failed staging leaves the candidate for diagnosis; never deletes worktrees or data.
    git(CORE, "worktree", "add", "--detach", str(release / "daclify-backend-core"), core_commit)
    git(MODULES, "worktree", "add", "--detach", str(release / "daclify-backend-modules"), module_commit)
    (release / "source.json").write_text(json.dumps({
        "environment": environment, "branch": branch,
        "coreCommit": core_commit, "modulesCommit": module_commit,
    }, indent=2) + "\n")
    return release


if __name__ == "__main__":
    try:
        if len(sys.argv) != 3:
            raise ValueError("Usage: prepare-release.py mainnet|testnet MODULES_COMMIT_SHA")
        print(prepare(sys.argv[1], sys.argv[2]))
    except ValueError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("RELEASE_PREPARATION_FAILED: existing releases and services were untouched.", file=sys.stderr)
        sys.exit(1)
