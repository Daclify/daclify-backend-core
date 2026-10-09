#!/usr/bin/python3
"""Exercise main/dev release isolation with real Git repositories and worktrees."""
import importlib.util
import json
import pathlib
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("prepare_release", pathlib.Path(__file__).with_name("prepare-release.py"))
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)
start_spec = importlib.util.spec_from_file_location("start_api", pathlib.Path(__file__).with_name("start-api.py"))
start = importlib.util.module_from_spec(start_spec)
start_spec.loader.exec_module(start)


def git(repo, *args):
    return subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True, text=True).stdout.strip()


class Releases(unittest.TestCase):
    def test_environment_credentials_cannot_be_shared(self):
        mainnet = {"DATABASE_URL": "postgres://main_app:main_password@127.0.0.1/mainnet",
                   "RELAY_ACCOUNT": "relay.main", "STRIPE_CONNECT_WEBHOOK_SECRET": "whsec_main_fixture"}
        testnet = {"DATABASE_URL": "postgres://test_app:test_password@127.0.0.1/testnet",
                   "RELAY_ACCOUNT": "relay.test", "STRIPE_CONNECT_WEBHOOK_SECRET": "whsec_test_fixture"}
        start.check_separation(mainnet, testnet)
        with self.assertRaisesRegex(ValueError, "SHARED_ENVIRONMENT_SECRET"):
            start.check_separation(mainnet, dict(testnet, DACLIFY_RAM_WEBHOOK_SECRET=mainnet["STRIPE_CONNECT_WEBHOOK_SECRET"]))
        with self.assertRaisesRegex(ValueError, "SHARED_ENVIRONMENT_SECRET"):
            start.check_separation(dict(mainnet, ARCHIVE_BACKUP_KEY="a" * 64), dict(testnet, ARCHIVE_BACKUP_KEY="a" * 64))
        with self.assertRaisesRegex(ValueError, "SHARED_DATABASE_CREDENTIAL"):
            start.check_separation(mainnet, dict(testnet, DATABASE_URL="postgres://test_app:main_password@127.0.0.1/testnet"))
        with self.assertRaisesRegex(ValueError, "SHARED_BLOCKCHAIN_ACCOUNT"):
            start.check_separation(mainnet, dict(testnet, RELAY_ACCOUNT="relay.main"))

    def test_independent_main_dev_and_module_artifacts(self):
        with tempfile.TemporaryDirectory(prefix="daclify-release-check-") as temporary:
            root = pathlib.Path(temporary)
            core = root / "core"
            modules = root / "modules"
            for repo in (core, modules):
                repo.mkdir()
                git(repo, "init", "-b", "main")
                git(repo, "config", "user.name", "Release fixture")
                git(repo, "config", "user.email", "fixture@example.invalid")
                (repo / "marker").write_text("main\n")
            (core / "tools/host").mkdir(parents=True)
            (core / "tools/host/preflight.ts").write_text("// fixture\n")
            (core / "tools/bootstrap.ts").write_text("// --backend-only fixture\n")
            for repo in (core, modules):
                git(repo, "add", ".")
                git(repo, "commit", "-m", "main fixture")
                git(repo, "remote", "add", "origin", str(repo))
            module_commit = git(modules, "rev-parse", "HEAD")
            saved = prepare.CORE, prepare.MODULES, prepare.RELEASES
            prepare.CORE, prepare.MODULES, prepare.RELEASES = core, modules, root / "deployments"
            try:
                mainnet = prepare.prepare("mainnet", module_commit)
                (mainnet / "daclify-backend-core/dist").mkdir()
                (mainnet / "daclify-backend-core/dist/api.js").write_text("stable mainnet")
                (mainnet / "daclify-backend-core/node_modules").mkdir()
                (mainnet / "daclify-backend-core/node_modules/marker").write_text("stable dependency")
                (core / "marker").write_text("uncommitted operator change\n")
                with self.assertRaisesRegex(ValueError, "BRANCH_FETCH_FAILED:dev"):
                    prepare.prepare("testnet", module_commit)
                self.assertFalse((prepare.RELEASES / "testnet").exists())
                self.assertEqual((core / "marker").read_text(), "uncommitted operator change\n")
                git(core, "checkout", "-b", "dev")
                (core / "marker").write_text("dev\n")
                git(core, "add", "marker")
                git(core, "commit", "-m", "dev fixture")
                testnet = prepare.prepare("testnet", module_commit)
                self.assertNotEqual(mainnet, testnet)
                self.assertEqual((mainnet / "daclify-backend-core/marker").read_text(), "main\n")
                self.assertEqual((testnet / "daclify-backend-core/marker").read_text(), "dev\n")
                (testnet / "daclify-backend-core/dist").mkdir()
                (testnet / "daclify-backend-core/dist/api.js").write_text("new testnet")
                self.assertEqual((mainnet / "daclify-backend-core/dist/api.js").read_text(), "stable mainnet")
                self.assertEqual((mainnet / "daclify-backend-core/node_modules/marker").read_text(), "stable dependency")
                self.assertFalse((testnet / "daclify-backend-core/node_modules").exists())
                self.assertNotEqual(mainnet / "daclify-backend-modules", testnet / "daclify-backend-modules")
                self.assertEqual(json.loads((mainnet / "source.json").read_text())["branch"], "main")
                self.assertEqual(json.loads((testnet / "source.json").read_text())["branch"], "dev")
                self.assertFalse((mainnet.parent.parent / "current").exists())
                with self.assertRaises(FileExistsError):
                    prepare.prepare("testnet", module_commit)
                self.assertEqual((mainnet / "daclify-backend-core/dist/api.js").read_text(), "stable mainnet")
            finally:
                prepare.CORE, prepare.MODULES, prepare.RELEASES = saved


if __name__ == "__main__":
    unittest.main()
