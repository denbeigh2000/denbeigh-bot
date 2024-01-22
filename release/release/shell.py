from pathlib import Path
from typing import Dict
import os
import subprocess


# https://stackoverflow.com/a/3505826
def source_file(shell_path: Path) -> Dict[str, str]:
    cmd = ["bash", "-c", f"source {shell_path} && env"]
    start_env = dict(**os.environ)

    output = subprocess.check_output(cmd, env=start_env)

    ps = [line.strip().partition("=") for line in output.decode().splitlines()]

    new_env_set = {(key, value) for (key, _, value) in ps}
    start_env_set = {_ for _ in start_env.items()}
    return dict(new_env_set - start_env_set)
