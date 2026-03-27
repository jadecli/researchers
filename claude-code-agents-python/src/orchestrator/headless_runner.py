"""HeadlessRunner wrapping claude -p subprocess for Agent SDK execution."""

from __future__ import annotations

import json
import logging
import subprocess
from typing import Any, Optional

logger = logging.getLogger(__name__)


class HeadlessRunner:
    """Wraps `claude -p` subprocess calls for headless agent execution.

    This runner sends prompts to the Claude CLI in headless mode and
    captures the structured output. It supports both single-shot and
    streaming JSON output modes.

    Usage:
        runner = HeadlessRunner()
        output = runner.run("Crawl https://example.com and extract all links")
        events = runner.run_streaming("Analyze this codebase")
    """

    def __init__(
        self,
        claude_binary: str = "claude",
        timeout: int = 300,
        model: Optional[str] = None,
        allowed_tools: Optional[list[str]] = None,
        max_turns: int = 10,
    ) -> None:
        """Initialize the HeadlessRunner.

        Args:
            claude_binary: Path to the claude CLI binary.
            timeout: Timeout in seconds for each run.
            model: Model override (e.g., 'claude-sonnet-4-20250514').
            allowed_tools: List of tools to allow (e.g., ['Bash', 'Read']).
            max_turns: Maximum conversation turns.
        """
        self.claude_binary = claude_binary
        self.timeout = timeout
        self.model = model
        self.allowed_tools = allowed_tools
        self.max_turns = max_turns

    def _build_command(self, prompt: str, streaming: bool = False) -> list[str]:
        """Build the claude CLI command."""
        cmd = [self.claude_binary, "-p", prompt]
        if streaming:
            cmd.extend(["--output-format", "stream-json"])
        else:
            cmd.extend(["--output-format", "json"])
        if self.model:
            cmd.extend(["--model", self.model])
        if self.allowed_tools:
            for tool in self.allowed_tools:
                cmd.extend(["--allowedTools", tool])
        cmd.extend(["--max-turns", str(self.max_turns)])
        return cmd

    def run(self, prompt: str) -> str:
        """Run a prompt through claude -p and return the result text.

        Args:
            prompt: The prompt to send to claude.

        Returns:
            The result text from claude's response.

        Raises:
            RuntimeError: If the subprocess fails or times out.
        """
        cmd = self._build_command(prompt, streaming=False)
        logger.info("Running headless: %s", " ".join(cmd[:4]) + " ...")

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout,
            )
        except subprocess.TimeoutExpired:
            raise RuntimeError(
                f"HeadlessRunner timed out after {self.timeout}s"
            )
        except FileNotFoundError:
            raise RuntimeError(
                f"Claude binary not found: {self.claude_binary}. "
                "Ensure Claude CLI is installed and in PATH."
            )

        if result.returncode != 0:
            logger.error("HeadlessRunner stderr: %s", result.stderr)
            raise RuntimeError(
                f"HeadlessRunner exited with code {result.returncode}: {result.stderr[:500]}"
            )

        try:
            parsed = json.loads(result.stdout)
            return parsed.get("result", result.stdout)
        except json.JSONDecodeError:
            return result.stdout.strip()

    def run_streaming(self, prompt: str) -> list[dict[str, Any]]:
        """Run a prompt in streaming mode, collecting all JSON events.

        Args:
            prompt: The prompt to send to claude.

        Returns:
            List of parsed JSON event dicts from the stream.

        Raises:
            RuntimeError: If the subprocess fails or times out.
        """
        cmd = self._build_command(prompt, streaming=True)
        logger.info("Running headless (streaming): %s", " ".join(cmd[:4]) + " ...")

        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
        except FileNotFoundError:
            raise RuntimeError(
                f"Claude binary not found: {self.claude_binary}. "
                "Ensure Claude CLI is installed and in PATH."
            )

        events: list[dict[str, Any]] = []
        try:
            assert proc.stdout is not None
            for line in proc.stdout:
                line = line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                    events.append(event)
                    logger.debug("Stream event: %s", event.get("type", "unknown"))
                except json.JSONDecodeError:
                    logger.warning("Non-JSON line in stream: %s", line[:200])
        finally:
            proc.wait(timeout=self.timeout)

        if proc.returncode != 0:
            stderr_output = proc.stderr.read() if proc.stderr else ""
            raise RuntimeError(
                f"HeadlessRunner (streaming) exited with code {proc.returncode}: "
                f"{stderr_output[:500]}"
            )

        return events

    def check_available(self) -> bool:
        """Check if the claude CLI is available.

        Returns:
            True if `claude --version` succeeds, False otherwise.
        """
        try:
            result = subprocess.run(
                [self.claude_binary, "--version"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return False
