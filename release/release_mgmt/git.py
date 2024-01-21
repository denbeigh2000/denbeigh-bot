from typing import List, Optional
import subprocess


def branch() -> str:
    cmd = ["git", "rev-parse", "--abbrev-ref", "HEAD"]
    return subprocess.check_output(cmd).decode()


def get_tags(sort: str = "-committerdate") -> List[str]:
    cmd = ["git", "tag", f"--sort={sort}", "--merged"]
    output = subprocess.check_output(cmd).decode().strip()

    return output.splitlines()


def tag(tag: str) -> None:
    cmd = ["git", "tag", tag]
    subprocess.run(cmd, check=True)


def checkout(branch: str, new: bool = False) -> None:
    new_arg = ["-b"] if new else []
    cmd = ["git", "checkout"] + new_arg + [branch]
    subprocess.run(cmd, check=True)


def push(
    remote: str = "origin",
    target: Optional[str] = None,
    tags: bool = False,
) -> None:
    args = ["git", "push", remote]
    if target:
        args.append(target)
    if tags:
        args.append("--tags")

    subprocess.run(args, check=True)


def assert_clean() -> None:
    cmd = ["git", "update-index", "--refresh"]
    subprocess.run(cmd)
    cmd = ["git", "diff-index", "--quiet", "HEAD", "--"]
    res = subprocess.run(cmd)
    if res.returncode != 0:
        raise RuntimeError("Unstaged changes detected")


def commit_hash() -> str:
    cmd = ["git", "rev-parse", "--verify", "HEAD"]
    return subprocess.check_output(cmd).decode()
