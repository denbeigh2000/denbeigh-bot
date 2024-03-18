from release.release_mgmt.version import Version

import unittest


class TestVersion(unittest.TestCase):
    def test_major_bump(self):
        v = Version(1, 2, 1)
        v.bump("major")
        self.assertEqual(v, Version(2, 0, 0))

    def test_minor_bump(self):
        v = Version(1, 2, 1)
        v.bump("minor")
        self.assertEqual(v, Version(1, 3, 0))

    def test_patch_bump(self):
        v = Version(1, 2, 1)
        v.bump("patch")
        self.assertEqual(v, Version(1, 2, 2))

    def test_parse(self):
        v = Version.from_tag("v0.6.9")
        self.assertEqual(v, Version(0, 6, 9))
