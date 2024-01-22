from pathlib import Path
from typing import List, Optional, Sequence, Union
import subprocess


PathEl = Union[str, Path]
PathEls = Sequence[PathEl]


class Git:
    def __init__(self, root: Path) -> None:
        self._root = root
        self._root_str = str(root)

    @classmethod
    def from_local_dir(cls) -> "Git":
        cmd = ["git", "rev-parse", "--show-toplevel"]
        root = subprocess.check_output(cmd).decode().strip()

        return cls(Path(root))

    def _cmd(self, argv: PathEls) -> PathEls:
        return ["git", "-C", self._root_str, *argv]

    def _run(
        self,
        argv: PathEls,
        check: bool = True,
        *args,
        **kwargs,
    ) -> subprocess.CompletedProcess:
        return subprocess.run(self._cmd(argv), check=check, *args, **kwargs)

    def _output(self, argv: PathEls) -> str:
        return subprocess.check_output(self._cmd(argv)).decode().strip()

    def root(self) -> Path:
        return self._root

    def branch(self) -> str:
        return self._output(["rev-parse", "--abbrev-ref", "HEAD"])

    def get_tags(self, sort: str = "-committerdate") -> List[str]:
        return self._output(["tag", f"--sort={sort}", "--merged"]).splitlines()

    def tag(self, tag: str) -> None:
        self._run(["tag", tag])

    def checkout(self, branch: str, new: bool = False) -> None:
        cmd = ["checkout"]
        if new:
            cmd.append("-b")
        cmd.append(branch)
        subprocess.run(cmd, check=True)

    def push(
        self,
        remote: str = "origin",
        target: Optional[str] = None,
        tags: bool = False,
    ) -> None:
        args = ["push", remote]
        if target:
            args.append(target)
        if tags:
            args.append("--tags")

        subprocess.run(args, check=True)

    def assert_clean(self) -> None:
        cmd = ["update-index", "--refresh"]
        self._run(cmd)
        cmd = ["diff-index", "--quiet", "HEAD", "--"]
        res = self._run(cmd)
        if res.returncode != 0:
            raise RuntimeError("Unstaged changes detected")

    def commit_hash(self) -> str:
        return self._output(["rev-parse", "--verify", "HEAD"])

    def ls_files(self, argv: Optional[PathEls] = None) -> List[Path]:
        cmd: List[PathEl] = ["ls-files", "-z"]
        if argv:
            cmd.extend(argv)
        raw = self._output(cmd)

        return [Path(p) for p in raw.split("\0")]
