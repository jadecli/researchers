"""Tests for plugin generation."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.models.plugin_spec import (
    AgentSpec,
    ConnectorSpec,
    PluginSpec,
    SkillSpec,
)
from src.plugin_gen.agent_writer import write_agent
from src.plugin_gen.connectors_writer import write_connectors
from src.plugin_gen.hooks_writer import write_hooks
from src.plugin_gen.lsp_config import write_lsp_config
from src.plugin_gen.manifest import write_manifest
from src.plugin_gen.mcp_config import write_mcp_config
from src.plugin_gen.scaffold import generate_plugin
from src.plugin_gen.skill_writer import write_skill


class TestSkillSpec:
    def test_full_name(self) -> None:
        spec = SkillSpec(name="my-skill")
        assert spec.full_name() == "my-skill.md"


class TestPluginSpec:
    def test_plugin_dir_name(self) -> None:
        spec = PluginSpec(name="My Cool Plugin")
        assert spec.plugin_dir_name == "my-cool-plugin"

    def test_counts(self) -> None:
        spec = PluginSpec(
            name="test",
            skills=[SkillSpec(name="s1"), SkillSpec(name="s2")],
            agents=[AgentSpec(name="a1")],
            connectors=[ConnectorSpec(name="c1")],
        )
        assert spec.skill_count == 2
        assert spec.agent_count == 1
        assert spec.connector_count == 1


class TestConnectorSpec:
    def test_has_placeholders(self) -> None:
        conn = ConnectorSpec(
            name="test",
            server_config={"api_key": "~~my_key~~"},
        )
        assert conn.has_placeholders()

    def test_no_placeholders(self) -> None:
        conn = ConnectorSpec(
            name="test",
            server_config={"command": "npx", "args": ["server"]},
        )
        assert not conn.has_placeholders()


class TestSkillWriter:
    def test_write_skill(self, tmp_path: Path) -> None:
        spec = SkillSpec(
            name="test-skill",
            description="A test skill",
            frontmatter={"tools": ["Bash", "Read"]},
            content="## Custom Content\n\nDo the thing.",
        )
        path = write_skill(spec, tmp_path / "skills")
        assert path.exists()
        content = path.read_text()
        assert "---" in content
        assert "test-skill" in content
        assert "A test skill" in content
        assert "Custom Content" in content

    def test_write_skill_default_body(self, tmp_path: Path) -> None:
        spec = SkillSpec(name="basic", description="Basic skill")
        path = write_skill(spec, tmp_path / "skills")
        content = path.read_text()
        assert "Usage" in content
        assert "Instructions" in content


class TestAgentWriter:
    def test_write_agent(self, tmp_path: Path) -> None:
        spec = AgentSpec(
            name="test-agent",
            description="A test agent",
            tools=["Bash", "Read"],
            system_prompt="You are a test agent. Be helpful.",
        )
        path = write_agent(spec, tmp_path / "agents")
        assert path.exists()
        content = path.read_text()
        assert "test-agent" in content
        assert "A test agent" in content
        assert "You are a test agent" in content
        assert "`Bash`" in content

    def test_write_agent_default_prompt(self, tmp_path: Path) -> None:
        spec = AgentSpec(name="simple", description="Simple agent")
        path = write_agent(spec, tmp_path / "agents")
        content = path.read_text()
        assert "You are simple" in content


class TestMcpConfig:
    def test_write_mcp_config(self, tmp_path: Path) -> None:
        connectors = [
            ConnectorSpec(
                name="test-server",
                type="stdio",
                server_config={"command": "npx", "args": ["-y", "server"]},
            )
        ]
        path = write_mcp_config(connectors, tmp_path / "mcp.json")
        assert path.exists()
        config = json.loads(path.read_text())
        assert "mcpServers" in config
        assert "test-server" in config["mcpServers"]


class TestConnectorsWriter:
    def test_write_connectors(self, tmp_path: Path) -> None:
        connectors = [
            ConnectorSpec(
                name="api-connector",
                type="sse",
                server_config={"url": "https://api.example.com"},
                placeholder_category="api",
            )
        ]
        output_dir = write_connectors(connectors, tmp_path / "connectors")
        assert (output_dir / "api-connector.json").exists()
        assert (output_dir / "index.json").exists()

        index = json.loads((output_dir / "index.json").read_text())
        assert index["total"] == 1


class TestHooksWriter:
    def test_write_hooks(self, tmp_path: Path) -> None:
        hooks = {
            "PreToolExecution": [
                {"type": "command", "command": "echo pre-tool"}
            ],
            "InvalidEvent": [
                {"type": "command", "command": "echo ignored"}
            ],
        }
        path = write_hooks(hooks, tmp_path / "hooks.json")
        assert path.exists()
        config = json.loads(path.read_text())
        assert "PreToolExecution" in config["hooks"]
        assert "InvalidEvent" not in config["hooks"]

    def test_validates_handlers(self, tmp_path: Path) -> None:
        hooks = {
            "PreToolExecution": [
                {"type": "command"},  # missing 'command' field
                {"type": "command", "command": "echo valid"},
            ],
        }
        path = write_hooks(hooks, tmp_path / "hooks.json")
        config = json.loads(path.read_text())
        assert len(config["hooks"]["PreToolExecution"]) == 1


class TestLspConfig:
    def test_write_lsp_config(self, tmp_path: Path) -> None:
        path = write_lsp_config(["pyright", "gopls"], tmp_path / "lsp.json")
        assert path.exists()
        config = json.loads(path.read_text())
        assert "pyright" in config["lspServers"]
        assert "gopls" in config["lspServers"]
        assert config["_meta"]["configured_servers"] == 2


class TestManifest:
    def test_write_manifest(self, tmp_path: Path) -> None:
        spec = PluginSpec(
            name="test-plugin",
            version="1.0.0",
            description="Test plugin",
            skills=[SkillSpec(name="s1", description="Skill 1")],
            agents=[AgentSpec(name="a1", description="Agent 1")],
        )
        path = write_manifest(spec, tmp_path / "plugin.json")
        assert path.exists()
        manifest = json.loads(path.read_text())
        assert manifest["name"] == "test-plugin"
        assert manifest["version"] == "1.0.0"
        assert len(manifest["skills"]) == 1
        assert len(manifest["agents"]) == 1


class TestGeneratePlugin:
    def test_full_generation(self, tmp_path: Path) -> None:
        spec = PluginSpec(
            name="full-test",
            description="Full test plugin",
            skills=[
                SkillSpec(name="skill-a", description="Skill A"),
                SkillSpec(name="skill-b", description="Skill B"),
            ],
            agents=[AgentSpec(name="agent-a", description="Agent A")],
            connectors=[
                ConnectorSpec(
                    name="connector-a",
                    type="stdio",
                    server_config={"command": "test"},
                )
            ],
            hooks={
                "PreToolExecution": [
                    {"type": "command", "command": "echo hello"}
                ]
            },
            lsp_servers=["pyright"],
        )
        plugin_dir = generate_plugin(spec, tmp_path)
        assert plugin_dir.exists()
        assert (plugin_dir / "plugin.json").exists()
        assert (plugin_dir / "skills" / "skill-a.md").exists()
        assert (plugin_dir / "skills" / "skill-b.md").exists()
        assert (plugin_dir / "agents" / "agent-a.md").exists()
        assert (plugin_dir / "connectors" / "mcp.json").exists()
        assert (plugin_dir / "hooks" / "hooks.json").exists()
        assert (plugin_dir / ".lsp" / "config.json").exists()
