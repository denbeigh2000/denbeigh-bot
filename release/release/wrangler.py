from pathlib import Path
from typing import Sequence, Union
import subprocess


PathEl = Union[Path, str]
PathEls = Sequence[PathEl]

COMPATIBILITY_DATE = "2023-03-02"


class Wrangler:
    def __init__(self, src_root: Path, wrangler_bin: Path):
        self._src_root = src_root
        self._wrangler_toml = src_root / "wrangler.toml"
        self._wrangler_bin = wrangler_bin

    def _run(
        self, cmd: PathEls, check: bool = True
    ) -> subprocess.CompletedProcess:
        argv = [self._wrangler_bin] + list(cmd)
        # TODO: global wrangler.toml path?
        return subprocess.run(argv, check=check, cwd=self._src_root)

    def deploy(self, env: str, bundle_path: Path) -> None:
        self._run(["deploy", "--env", env, "--no-bundle", bundle_path])

    def build(self, out_dir: Path) -> None:
        cmd: PathEls = [
            "deploy",
            "--compatibility-date",
            COMPATIBILITY_DATE,
            "--name",
            "local-build",
            "--minify",
            "--dry-run",
            "--outdir",
            out_dir,
            "src/index.ts",
        ]
        self._run(cmd)
