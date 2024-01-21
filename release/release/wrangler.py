from dataclasses import dataclass
from pathlib import Path
from typing import Sequence, Union
import subprocess


PathEl = Union[Path, str]
PathEls = Sequence[PathEl]


@dataclass
class Wrangler:
    wrangler_toml: Path
    wrangler_bin: Path

    def _run(
        self, cmd: PathEls, check: bool = True
    ) -> subprocess.CompletedProcess:
        cwd = self.wrangler_toml.parent
        argv = [self.wrangler_bin] + list(cmd)
        # TODO: global wrangler.toml path?
        return subprocess.run(argv, check=check, cwd=cwd)

    def deploy(self, env: str, bundle_path: Path) -> None:
        self._run(["deploy", "--env", env, "--no-bundle", bundle_path])

    def build(self) -> None:
        # TODO
        raise NotImplementedError
