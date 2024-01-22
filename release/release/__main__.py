#!/usr/bin/env python3

from release.environment import Environment
from release.release_mgmt import git, manager
from release.release_mgmt.version import Mode, Version
from release.sentry import Sentry
from release.wrangler import Wrangler

from pathlib import Path
import shutil

import click

BUMP_MODES = ["major", "minor", "patch"]
RELEASE_MODES = ["staging", "production"]

RELEASE_BRANCH_PREFIX = "release/"

SUPPORTED_ID_TYPES = ["rsa", "ed25519"]


@click.group()
def cli() -> None:
    pass


@cli.command()
def print_version() -> None:
    version = manager.last_version() or Version(0, 0, 0)
    print(version.version_string("patch"))


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


@cli.command()
@click.argument("OUTPUT_DIRECTORY", required=True)
@click.argument("NODE_MODULES_PATH", required=True)
def build(output_directory: str, node_modules_path: str) -> None:
    output_dir = Path(output_directory.strip())
    node_modules_dir = Path(node_modules_path.strip())

    # TODO: improve?
    proj_dir = Path.cwd()
    node_modules = proj_dir / "node_modules"

    # Just in case we want to use the local node_modules (experimentation, etc)
    if node_modules != node_modules_dir:
        node_modules.unlink(missing_ok=True)
        node_modules.symlink_to(node_modules_dir)

    wrangler_toml = proj_dir / "wrangler.toml"
    wrangler_bin = Environment.setup_wrangler(wrangler_toml)
    wrangler = Wrangler(wrangler_toml=wrangler_toml, wrangler_bin=wrangler_bin)

    tmp_build_dir = proj_dir / "dest"
    tmp_build_dir.mkdir(exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    wrangler.build(tmp_build_dir)
    for f in ("index.js", "index.js.map"):
        shutil.move(tmp_build_dir / f, output_dir / f)


if __name__ == "__main__":
    cli()
