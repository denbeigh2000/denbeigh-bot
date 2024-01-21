#!/usr/bin/env python3

from environment import Environment
from release_mgmt import git, manager
from release_mgmt.version import Mode
from sentry import Sentry
from wrangler import Wrangler

from pathlib import Path

import click

BUMP_MODES = ["major", "minor", "patch"]
RELEASE_MODES = ["staging", "production"]

RELEASE_BRANCH_PREFIX = "release/"

SUPPORTED_ID_TYPES = ["rsa", "ed25519"]


@click.group()
def cli() -> None:
    pass


@cli.command()
@click.argument("MODE", type=click.Choice(BUMP_MODES), default=None)
def bump_version(mode: Mode) -> None:
    assert mode in ("major", "minor", "patch")
    manager.version_bump(mode)


@cli.command()
@click.argument(
    "RELEASE_MODE",
    type=click.Choice(RELEASE_MODES),
    default="production",
    envvar="ENV",
)
@click.argument("BUMP_MODE", type=click.Choice(BUMP_MODES), default="patch")
@click.argument("BUNDLE_PATH", type=Path)
@click.argument("SOURCEMAP_PATH", type=Path)
def deploy(
    release_mode: str, bump_mode: Mode, bundle_path: Path, sourcemap_path: Path
) -> None:
    env = Environment.from_env()
    sentry = Sentry(
        org=env.sentry.org,
        project=env.sentry.project_id,
        auth_token=env.sentry.token,
    )
    wrangler = Wrangler(
        wrangler_toml=env.wrangler_toml_path,
        wrangler_bin=env.wrangler_bin,
    )
    is_prod = release_mode == "production"

    tag_str = ""
    if is_prod:
        git.assert_clean()
        assert manager.is_release_branch(env.git_branch)
        new_version = manager.version_bump(bump_mode)
        tag_str = f"v{new_version.version_string()}"
        hash = git.commit_hash()
        git.push(tags=True)
        sentry.create_release(commit=hash, tag=tag_str)

    wrangler.deploy(release_mode, bundle_path)

    if is_prod:
        sentry.upload_sourcemaps(tag_str, bundle_path, sourcemap_path)
