from pathlib import Path
from typing import Iterable
import textwrap


def format_paths(paths: Iterable[Path]) -> str:
    if not paths:
        return "<none>"

    return textwrap.indent("\n".join(str(p) for p in paths), prefix=" - ")
