from release.release_mgmt import git
from release.release_mgmt.version import Mode, Version

from copy import deepcopy
from typing import Optional
import re

RELEASE_PREFIX = "release/"
TAG_REGEX = re.compile(r"^v([0-9]+)\.([0-9]+)\.([0-9]+)$")


def is_release_branch(branch: Optional[str] = None) -> bool:
    if not branch:
        branch = git.branch()
    assert branch  # mypy

    return branch.startswith("release/")


class VersionBumpError(RuntimeError):
    pass


def version_bump(mode: Mode) -> Version:
    assert mode in ("major", "minor", "patch")

    branch = git.branch()
    version = last_version()
    assert version, "couldn't find version"

    new_version = deepcopy(version)
    new_version.bump(mode)

    if mode in ("major", "minor"):
        if branch != "master":
            raise VersionBumpError(
                f"need to be on main branch for a {mode} bump"
            )

        # release/x.y
        min_version = version.version_string("minor")
        release_branch = f"{RELEASE_PREFIX}{min_version}"
        git.checkout(release_branch, new=True)
    elif mode == "patch":
        if not is_release_branch(branch):
            raise VersionBumpError(
                "need to be on a release branch for patch bump"
            )

    version_str = new_version.version_string(mode)
    tag = f"v{version_str}"
    git.tag(tag)
    return new_version


def last_version() -> Optional[Version]:
    tags = git.get_tags()
    version_tag = next((t for t in tags if TAG_REGEX.match(t)), None)

    if not version_tag:
        return None

    match = TAG_REGEX.match(version_tag)
    assert match  # for mypy, tested earlier with filter

    (major, minor, patch) = (int(i) for i in match.groups())
    return Version(major, minor, patch)
