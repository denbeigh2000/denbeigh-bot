from release.release_mgmt.git import Git
from release.release_mgmt.manager import (
    BadBranchError,
    ReleaseManager,
    NotReleaseBranchError,
)
from release.release_mgmt.version import Version

import unittest
from unittest.mock import MagicMock


class TestReleaseManager(unittest.TestCase):
    def setUp(self):
        self.git: Git = MagicMock(spec=Git)
        self.rm = ReleaseManager(self.git)

    def test_release_branch(self):
        branch_name = "release/0.3"
        self.assertTrue(self.rm.is_release_branch(branch_name))

        self.assertFalse(self.rm.is_release_branch("notrelease/1.2"))

    def test_release_branch_version(self):
        branch_name = "release/0.4"
        v = Version(0, 4, 1)
        self.rm.assert_is_release_branch_for_version(v, branch_name)

        with self.assertRaises(NotReleaseBranchError):
            bad_v = Version(0, 5, 0)
            self.rm.assert_is_release_branch_for_version(bad_v, branch_name)

    def test_major_bump_only_on_master(self):
        self.git.branch.return_value = "release/0.3"
        self.git.get_tags.return_value = ["v0.3.0"]

        with self.assertRaises(BadBranchError):
            self.rm.version_bump("major")

        self.git.tag.assert_not_called()

        self.git.branch.return_value = "master"
        self.rm.version_bump("major")
        self.git.tag.assert_called_with("v1.0.0")

    def test_minor_bump_only_on_master(self):
        self.git.branch.return_value = "release/0.3"
        self.git.get_tags.return_value = ["v0.3.0"]

        with self.assertRaises(BadBranchError):
            self.rm.version_bump("minor")

        self.git.tag.assert_not_called()

        self.git.branch.return_value = "master"
        self.rm.version_bump("minor")
        self.git.tag.assert_called_with("v0.4.0")

    def test_patch_bump_only_on_release(self):
        self.git.branch.return_value = "master"
        self.git.get_tags.return_value = ["v0.3.0"]

        with self.assertRaises(NotReleaseBranchError):
            self.rm.version_bump("patch")

        self.git.tag.assert_not_called()

        self.git.branch.return_value = "release/0.3"
        self.rm.version_bump("patch")
        self.git.tag.assert_called_with("v0.3.1")
