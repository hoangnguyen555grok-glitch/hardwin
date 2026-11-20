from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from assistant_app import _contains_secret, _requires_approval
from memory_store import MemoryStore


class AgentSafetyTests(unittest.TestCase):
    def test_rejects_inline_api_key(self) -> None:
        self.assertTrue(_contains_secret("Check this API_KEY=sk-supersecret123"))

    def test_rejects_inline_password(self) -> None:
        self.assertTrue(_contains_secret("password: my-private-password"))

    def test_rejects_vietnamese_password_phrase(self) -> None:
        self.assertTrue(_contains_secret("Mật khẩu của tôi là abc123"))

    def test_allows_regular_editor_task(self) -> None:
        self.assertFalse(_contains_secret("Mở Geed Hardwin và kiểm tra số layer"))

    def test_delete_requires_explicit_approval(self) -> None:
        self.assertTrue(_requires_approval("Xóa layer đang chọn"))

    def test_read_only_task_does_not_require_approval(self) -> None:
        self.assertFalse(_requires_approval("Đọc timeline và báo số frame"))


class MemoryStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.store = MemoryStore(Path(self.temp_dir.name) / "memory.sqlite")

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_recall_is_scoped_to_thread(self) -> None:
        self.store.remember_success("thread-a", "Inspect timeline layers", "Found 4 layers")
        self.assertEqual(len(self.store.recall("thread-a", "timeline")), 1)
        self.assertEqual(len(self.store.recall("thread-b", "timeline")), 0)

    def test_memory_redacts_common_credentials_and_emails(self) -> None:
        self.store.remember_success(
            "thread-a",
            "Check API_KEY=sk-secret-123",
            "Contact owner@example.com; password: super-secret",
        )
        records = self.store.recent()
        self.assertEqual(len(records), 1)
        text = records[0]["task"] + records[0]["result"]
        self.assertNotIn("sk-secret-123", text)
        self.assertNotIn("owner@example.com", text)
        self.assertNotIn("super-secret", text)
        self.assertIn("[REDACTED]", text)
        self.assertIn("[EMAIL]", text)

    def test_clear_removes_task_memory(self) -> None:
        self.store.remember_success("thread-a", "Inspect scene", "Found Scene 01")
        self.assertEqual(self.store.count(), 1)
        self.assertEqual(self.store.clear(), 1)
        self.assertEqual(self.store.count(), 0)


if __name__ == "__main__":
    unittest.main()
