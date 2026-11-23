import contextlib
import importlib.util
import io
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

SCRIPT = Path(__file__).with_name("most_fachman.py")
SPEC = importlib.util.spec_from_file_location("most_fachman", SCRIPT)
most_fachman = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(most_fachman)


class FachmanBridgeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.ppc = root / "PPC"
        python = self.ppc / ".venv" / "bin" / "python"
        python.parent.mkdir(parents=True)
        python.touch()
        most_fachman.PPC = self.ppc
        most_fachman.OUT = root / "data-most"

    def tearDown(self):
        self.temp.cleanup()

    def test_does_not_write_partial_files_when_one_provider_fails(self):
        results = [
            SimpleNamespace(returncode=0, stdout='[{"campaign":{"name":"Search"}}]', stderr=""),
            SimpleNamespace(returncode=1, stdout="", stderr="Meta authorization failed"),
        ]
        output = io.StringIO()
        with patch.object(sys, "argv", [str(SCRIPT), "studio", "--google", "123-456-7890", "--meta", "act_123456"]), patch.object(most_fachman.subprocess, "run", side_effect=results), contextlib.redirect_stdout(output):
            with self.assertRaises(SystemExit) as error:
                most_fachman.main()
        self.assertIn("Meta authorization failed", str(error.exception))
        self.assertFalse(most_fachman.OUT.exists())

    def test_saves_both_exports_after_successful_read(self):
        results = [
            SimpleNamespace(returncode=0, stdout='[{"campaign":{"name":"Search"}}]', stderr=""),
            SimpleNamespace(returncode=0, stdout='[{"campaign_name":"Meta"}]', stderr=""),
        ]
        output = io.StringIO()
        with patch.object(sys, "argv", [str(SCRIPT), "studio", "--google", "1234567890", "--meta", "act_123456", "--dny", "7"]), patch.object(most_fachman.subprocess, "run", side_effect=results), contextlib.redirect_stdout(output):
            most_fachman.main()
        files = sorted(most_fachman.OUT.glob("*.json"))
        self.assertEqual(len(files), 2)
        self.assertIn("SOUBOR:", output.getvalue())


if __name__ == "__main__":
    unittest.main()
