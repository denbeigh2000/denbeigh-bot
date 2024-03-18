from release.release_mgmt.git import Git
from release.release_mgmt.version import Mode, Version

from typing import Optional
import re

RELEASE_PREFIX = "release/"
TAG_REGEX = re.compile(r"^v([0-9]+)\.([0-9]+)\.([0-9]+)$")


class VersionBumpError(RuntimeError):
    pass


class BadBranchError(VersionBumpError):
    def __init__(self, mode: str) -> None:
        super().__init__(f"need to be on main branch for a {mode} bump")


class NotReleaseBranchError(VersionBumpError):
    def __init__(self, exp: str, actual: str) -> None:
        super().__init__(
            "need to be on correct release branch for patch bump "
            f"(expected {exp}, on {actual})"
        )


class ReleaseManager:
    def __init__(self, git: Git) -> None:
        self._git = git

    @classmethod
    def from_local_dir(cls) -> "ReleaseManager":
        return cls(git=Git.from_local_dir())

    def is_release_branch(self, branch: Optional[str] = None) -> bool:
        # NOTE: new assignment so mypy no longer considers it Optional
        branch_ = branch or self._git.branch()
        return branch_.startswith(RELEASE_PREFIX)

    def assert_is_release_branch_for_version(
        self,
        version: Version,
        branch: Optional[str] = None,
    ) -> None:
        exp = f'{RELEASE_PREFIX}{version.version_string("minor")}'
        branch_ = branch or self._git.branch()
        if branch_ != exp:
            raise NotReleaseBranchError(exp, branch_)

    def version_bump(self, mode: Mode) -> Version:
        assert mode in ("major", "minor", "patch")

        branch = self._git.branch()
        version = self.last_version()
        assert version, "couldn't find version"

        version.bump(mode)

        if mode in ("major", "minor"):
            if branch != "master":
                raise BadBranchError(mode)

            # release/x.y
            min_version = version.version_string("minor")
            release_branch = f"{RELEASE_PREFIX}{min_version}"
            self._git.checkout(release_branch, new=True)
        elif mode == "patch":
            self.assert_is_release_branch_for_version(version, branch)

        # vx.y.z
        version_str = version.version_string()
        tag = f"v{version_str}"
        self._git.tag(tag)
        return version

    def last_version(self) -> Optional[Version]:
        tags = self._git.get_tags()
        version_tag = next((t for t in tags if TAG_REGEX.match(t)), None)

        if not version_tag:
            return None

        match = TAG_REGEX.match(version_tag)
        assert match  # for mypy, tested earlier with filter

        (major, minor, patch) = (int(i) for i in match.groups())
        return Version(major, minor, patch)
