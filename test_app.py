import unittest

import pandas as pd

from app import add_manual_entry, empty_entries, normalize_entries


class AppEntryTests(unittest.TestCase):
    def test_add_manual_entry_appends_row(self):
        entries = empty_entries()
        updated = add_manual_entry(entries, " Manual One ", " https://example.com/manual ")
        self.assertEqual(len(updated.index), 1)
        self.assertEqual(updated.iloc[0]["name"], "Manual One")
        self.assertEqual(updated.iloc[0]["url"], "https://example.com/manual")

    def test_add_manual_entry_requires_both_fields(self):
        with self.assertRaises(ValueError):
            add_manual_entry(empty_entries(), "Only name", "")

    def test_normalize_entries_keeps_required_columns(self):
        mixed = pd.DataFrame(
            [
                {"name": "Imported One", "url": "https://example.com/one"},
                {"name": "", "url": ""},
                {"name": None, "url": "https://example.com/two"},
            ]
        )
        normalized = normalize_entries(mixed)
        self.assertListEqual(list(normalized.columns), ["name", "url"])
        self.assertEqual(len(normalized.index), 2)


if __name__ == "__main__":
    unittest.main()
