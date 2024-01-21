from dataclasses import dataclass
from pathlib import Path
from typing import Sequence, Union
import subprocess
import os


PathEl = Union[str, Path]
PathEls = Sequence[PathEl]


@dataclass
class Sentry:
    org: str
    project: str
    auth_token: str

    def _run(
        self, cmd: Sequence[PathEl], check=True, *args, **kwargs
    ) -> subprocess.CompletedProcess:
        env = {**os.environ}
        env["SENTRY_AUTH_TOKEN"] = self.auth_token

        argv = ["sentry-cli"] + list(cmd)
        return subprocess.run(argv, env=env, check=check, *args, **kwargs)  # type: ignore

    def _releases(self, cmd: Sequence[PathEl]) -> subprocess.CompletedProcess:
        argv = [
            "releases",
            "--org",
            self.org,
            "--project",
            self.project,
        ] + list(cmd)

        return self._run(argv)

    def create_release(self, commit: str, tag: str) -> None:
        cmd = ["new", tag]
        self._releases(cmd)

        cmd = ["set-commits", "--commit", f"origin@${commit}", tag]
        self._releases(cmd)

    def upload_sourcemaps(
        self,
        tag: str,
        bundle: Path,
        bundle_sourcemap: Path,
    ) -> None:
        cmd: PathEls = [
            "files",
            tag,
            "upload-sourcemaps",
            "--bundle",
            bundle,
            "--bundle-sourcemap",
            bundle_sourcemap,
        ]
        self._releases(cmd)
