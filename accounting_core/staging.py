from __future__ import annotations

import sqlite3
from pathlib import Path


def open_database(path: Path | str = ":memory:") -> sqlite3.Connection:
    connection = sqlite3.connect(path)
    schema = Path(__file__).with_name("schema.sql").read_text(encoding="utf-8")
    connection.executescript(schema)
    return connection
