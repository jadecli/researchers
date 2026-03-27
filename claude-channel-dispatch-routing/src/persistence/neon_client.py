"""
Neon Postgres client with connection pooling and thread-safe query execution.
"""

import logging
import os
import threading
from typing import Any, Dict, List, Optional, Tuple, Union

import psycopg2
import psycopg2.extras
import psycopg2.pool

logger = logging.getLogger(__name__)

Params = Union[Tuple, Dict[str, Any], None]


class NeonClient:
    """Thread-safe Postgres client backed by a connection pool for Neon databases."""

    def __init__(self, database_url: Optional[str] = None, min_conn: int = 1, max_conn: int = 5):
        self._database_url = database_url or os.environ.get("DATABASE_URL")
        if not self._database_url:
            raise ValueError(
                "DATABASE_URL must be provided as an argument or set in the environment"
            )

        self._lock = threading.Lock()
        self._pool: Optional[psycopg2.pool.ThreadedConnectionPool] = None

        try:
            self._pool = psycopg2.pool.ThreadedConnectionPool(
                minconn=min_conn,
                maxconn=max_conn,
                dsn=self._database_url,
            )
            logger.info("NeonClient: connection pool created (min=%d, max=%d)", min_conn, max_conn)
        except psycopg2.Error as exc:
            logger.error("NeonClient: failed to create connection pool: %s", exc)
            raise

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def execute(self, sql: str, params: Params = None) -> List[Dict[str, Any]]:
        """Execute a query and return all result rows as a list of dicts.

        For INSERT / UPDATE / DELETE statements that return no rows the list
        will be empty.
        """
        logger.debug("NeonClient.execute: %s | params=%s", sql, params)
        conn = self._get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, params)
                conn.commit()
                if cur.description is not None:
                    rows = cur.fetchall()
                    return [dict(row) for row in rows]
                return []
        except psycopg2.Error as exc:
            conn.rollback()
            logger.error("NeonClient.execute error: %s", exc)
            raise
        finally:
            self._put_conn(conn)

    def execute_one(self, sql: str, params: Params = None) -> Optional[Dict[str, Any]]:
        """Execute a query and return the first row as a dict, or None."""
        logger.debug("NeonClient.execute_one: %s | params=%s", sql, params)
        conn = self._get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, params)
                conn.commit()
                if cur.description is not None:
                    row = cur.fetchone()
                    return dict(row) if row else None
                return None
        except psycopg2.Error as exc:
            conn.rollback()
            logger.error("NeonClient.execute_one error: %s", exc)
            raise
        finally:
            self._put_conn(conn)

    def is_connected(self) -> bool:
        """Return True if the pool is alive and a connection can be obtained."""
        if self._pool is None or self._pool.closed:
            return False
        try:
            conn = self._get_conn()
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                return True
            finally:
                self._put_conn(conn)
        except Exception:
            return False

    def close(self) -> None:
        """Close all connections in the pool."""
        with self._lock:
            if self._pool is not None and not self._pool.closed:
                self._pool.closeall()
                logger.info("NeonClient: connection pool closed")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_conn(self):
        with self._lock:
            if self._pool is None or self._pool.closed:
                raise RuntimeError("NeonClient: connection pool is closed")
            return self._pool.getconn()

    def _put_conn(self, conn):
        with self._lock:
            if self._pool is not None and not self._pool.closed:
                self._pool.putconn(conn)
