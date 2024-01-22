from release.release_mgmt.git import Git
from release.secrets import Secrets
from release.shell import source_file
from release.utils import format_paths

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, Generic, Optional, Type, TypeVar
import os
import shutil

BUMP_MODES = ["major", "minor", "patch"]
RELEASE_MODES = ["staging", "production"]

RELEASE_BRANCH_PREFIX = "release/"

SUPPORTED_ID_TYPES = ["rsa", "ed25519"]


E = TypeVar("E", bound="EnvironmentCredentials")


def decrypt_secret(git: Git, filename: str, secrets: Secrets) -> Path:
    path_ref = f":/secrets/{filename}.age"
    secret_path = git.ls_files([path_ref])
    n_found = len(secret_path)
    if n_found != 1:
        found = format_paths(secret_path)
        msg = f"should find exactly one secret for {filename}, found:\n{found}"
        raise AssertionError(msg)
    return secrets.decrypt(secret_path[0])


class EnvironmentCredentials(ABC, Generic[E]):
    @classmethod
    def from_secret_file(cls: Type[E], git: Git, fname: str, s: Secrets) -> E:
        temp_file = decrypt_secret(git, fname, s)
        new_env = source_file(temp_file)
        total_env = {**os.environ, **new_env}
        return cls.from_env(total_env)

    @classmethod
    @abstractmethod
    def from_env(cls: Type[E], env: Dict[str, str]) -> E:
        ...


class CFCredentials(EnvironmentCredentials["CFCredentials"]):
    def __init__(self, token: str, account_id: str):
        self.token = token
        self.account_id = account_id

    @classmethod
    def from_env(
        cls: Type["CFCredentials"], env: Dict[str, str]
    ) -> "CFCredentials":
        return cls(
            token=env["CLOUDFLARE_API_TOKEN"],
            account_id=env["CLOUDFLARE_ACCOUNT_ID"],
        )


class SentryCredentials(EnvironmentCredentials["SentryCredentials"]):
    def __init__(self, project_id: str, token: str, org: str):
        self.project_id = project_id
        self.token = token
        self.org = org

    @classmethod
    def from_env(cls, env: Dict[str, str]) -> "SentryCredentials":
        return cls(
            project_id=env["SENTRY_PROJECT"],
            token=env["SENTRY_AUTH_TOKEN"],
            org=env["SENTRY_ORG"],
        )


@dataclass
class Environment:
    cf: CFCredentials
    sentry: SentryCredentials

    git: Git

    wrangler_bin: Path
    wrangler_toml_path: Path

    @staticmethod
    def get_environ(
        envvar: str,
        default: Optional[Callable[[], str]] = None,
    ) -> str:
        val = os.environ.get(envvar)
        if not val:
            if default:
                return default()

            raise AssertionError(f"missing {envvar} env var")

        return val.strip()

    @classmethod
    def setup_wrangler(
        cls, git: Git, dest_toml: Path, secrets: Optional[Secrets] = None
    ):
        # NOTE: Even though we can provide a path to wrangler.toml, wrangler
        # still expects resources to be located relative to that directory.
        s = secrets or Secrets.from_env()
        wrangler_bin = Path(cls.get_environ("WRANGLER_BIN"))
        wrangler_toml_tmp = decrypt_secret(git, "wrangler.toml", s)
        shutil.move(wrangler_toml_tmp, dest_toml)

        return wrangler_bin

    @classmethod
    def from_env(cls) -> "Environment":
        s = Secrets.from_env()
        git = Git.from_local_dir()

        cf = CFCredentials.from_secret_file(git, "cf_authn.sh", s)
        sentry = SentryCredentials.from_secret_file(git, "sentry_authn.sh", s)

        wrangler_toml = git.root() / "wrangler.toml"
        wrangler_bin = cls.setup_wrangler(git, wrangler_toml, s)

        return cls(
            cf,
            sentry,
            git,
            wrangler_bin,
            wrangler_toml,
        )
