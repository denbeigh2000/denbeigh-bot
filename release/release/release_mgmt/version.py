from dataclasses import dataclass
from typing import Literal, Union

Mode = Union[Literal["major"], Literal["minor"], Literal["patch"]]


@dataclass
class Version:
    major: int
    minor: int
    patch: int

    @classmethod
    def from_str(cls, init: str) -> "Version":
        (major, minor, patch) = (int(i) for i in init.split("."))
        return cls(major, minor, patch)

    @classmethod
    def from_tag(cls, init: str) -> "Version":
        return cls.from_str(init.removeprefix("v"))

    def __repr__(self) -> str:
        return f"Version<{self.major}.{self.minor}.{self.patch}>"

    def version_string(self, mode: Mode = "patch") -> str:
        if mode == "major":
            return str(self.major)

        if mode == "minor":
            return f"{self.major}.{self.minor}"

        if mode == "patch":
            return f"{self.major}.{self.minor}.{self.patch}"

        raise RuntimeError(f"invalid mode: {mode}")

    def bump(self, mode: Mode) -> None:
        assert mode in ("major", "minor", "patch")

        if mode == "major":
            self.major += 1
            self.minor = 0
            self.patch = 0
        elif mode == "minor":
            self.minor += 1
            self.patch = 0
        elif mode == "patch":
            self.patch += 1
