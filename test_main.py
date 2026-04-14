import unittest

import pandas as pd

from main import image_filename, validate_data


class MainHelpersTests(unittest.TestCase):
    def test_image_filename_sanitizes_unsafe_characters(self):
        self.assertEqual(image_filename("../unsafe:name"), "unsafe_name.png")

    def test_image_filename_falls_back_when_empty(self):
        self.assertEqual(image_filename("..."), "entry.png")

    def test_validate_data_accepts_required_columns(self):
        data = pd.DataFrame([{"name": "GitHub", "url": "https://github.com"}])
        validate_data(data)

    def test_validate_data_rejects_missing_columns(self):
        data = pd.DataFrame([{"name": "GitHub"}])
        with self.assertRaises(ValueError):
            validate_data(data)


if __name__ == "__main__":
    unittest.main()
