from dataclasses import dataclass
from pathlib import Path
from typing import List, Sequence, Union
import functools
import subprocess
import tempfile
import textwrap

SUPPORTED_ID_TYPES = ["rsa", "ed25519"]


@dataclass
class Secrets:
    identities: List[Path]

    @functools.lru_cache
    def _id_args(self) -> List[str]:
        # [--identity, <path>, --identity, <path>]
        return [_ for _ in [("--identity", p) for p in self.identities]]

    @classmethod
    def from_env(cls) -> "Secrets":
        ssh_dir = Path.home() / ".ssh"
        paths = (ssh_dir / f"id_{id_type}" for id_type in SUPPORTED_ID_TYPES)
        existing_paths = [p for p in paths if p.exists()]
        if not existing_paths:
            searched = "\n".join(str(p) for p in paths)
            textwrap.indent(searched, " - ")

            raise AssertionError(f"No paths found. Searched:\n{searched}")

        return cls(existing_paths)

    def decrypt(self, path: Path) -> Path:
        tmp = tempfile.mktemp()
        tail_args: List[Union[str, Path]] = ["--output", tmp, path]
        cmd: Sequence[Union[str, Path]] = ["age"] + self._id_args() + tail_args

        subprocess.run(cmd, check=True)
        return Path(tmp)
