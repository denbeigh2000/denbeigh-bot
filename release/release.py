#!/usr/bin/env python3

from secrets import Secrets
from shell import source_file

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, Generic, Optional, Type, TypeVar
import os
import shutil
import subprocess

import click

BUMP_MODES = ["major", "minor", "patch"]
RELEASE_MODES = ["staging", "production"]

RELEASE_BRANCH_PREFIX = "release/"

SUPPORTED_ID_TYPES = ["rsa", "ed25519"]


E = TypeVar("E", bound="EnvironmentCredentials")


def decrypt_secret(filename: str, secrets: Secrets) -> Path:
    path_ref = f":/secrets/{filename}.age"
    secret_path = subprocess.check_output(["git", "ls-files", path_ref])
    path = Path(secret_path.decode())
    return secrets.decrypt(path)


class EnvironmentCredentials(ABC, Generic[E]):
    @classmethod
    def from_secret_file(cls: Type[E], filename: str, secrets: Secrets) -> E:
        temp_file = decrypt_secret(filename, secrets)
        new_env = source_file(temp_file)
        total_env = {**os.environ, **new_env}
        return cls.from_env(total_env)

    @abstractmethod
    @classmethod
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

    wrangler_bin: Path
    wrangler_toml_path: Path

    git_branch: str

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

        return val

    @classmethod
    def from_env(cls) -> "Environment":
        secrets = Secrets.from_env()

        cmd = ["git", "rev-parse", "--show-toplevel"]
        git_root = Path(subprocess.check_output(cmd).decode())
        wrangler_toml = git_root / "wrangler.toml"

        cmd = ["git", "rev-parse", "--abbrev-ref", "HEAD"]
        git_branch = subprocess.check_output(cmd).decode()

        cf = CFCredentials.from_secret_file("cf_authn.sh", secrets)
        sentry = SentryCredentials.from_secret_file("sentry_authn.sh", secrets)

        # NOTE: Even though we can provide a path to wrangler.toml, wrangler
        # still expects resources to be located relative to that directory.
        wrangler_bin = Path(cls.get_environ("WRANGLER_BIN"))
        wrangler_toml_tmp = decrypt_secret("wrangler.toml", secrets)
        shutil.move(wrangler_toml_tmp, wrangler_toml)

        return cls(
            cf,
            sentry,
            wrangler_bin,
            wrangler_toml,
            git_branch,
        )


@click.command()
@click.argument(
    "RELEASE_MODE",
    type=click.Choice(RELEASE_MODES),
    default="production",
    envvar="ENV",
)
@click.argument("BUMP_MODE", type=click.Choice(BUMP_MODES), default=None)
def main(release_mode: str, bump_mode: str) -> None:
    pass
