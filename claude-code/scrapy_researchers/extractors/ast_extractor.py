"""AST-based code symbol extraction using tree-sitter grammars."""

from __future__ import annotations

import logging
from collections import Counter
from dataclasses import dataclass, field

import tree_sitter as ts

logger = logging.getLogger(__name__)

# Extension-to-language mapping
_EXT_MAP: dict[str, str] = {
    ".py": "python",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".rb": "ruby",
}

# Node types that represent symbols we want to extract, keyed by language
_SYMBOL_NODE_TYPES: dict[str, dict[str, str]] = {
    "python": {
        "function_definition": "function",
        "class_definition": "class",
        "import_statement": "import",
        "import_from_statement": "import",
        "decorated_definition": "decorated",
    },
    "typescript": {
        "function_declaration": "function",
        "class_declaration": "class",
        "export_statement": "export",
        "import_statement": "import",
        "type_alias_declaration": "type",
        "interface_declaration": "type",
        "method_definition": "method",
    },
    "javascript": {
        "function_declaration": "function",
        "class_declaration": "class",
        "export_statement": "export",
        "import_statement": "import",
        "method_definition": "method",
    },
    "go": {
        "function_declaration": "function",
        "method_declaration": "method",
        "type_declaration": "type",
        "import_declaration": "import",
    },
    "rust": {
        "function_item": "function",
        "impl_item": "class",
        "struct_item": "type",
        "enum_item": "type",
        "trait_item": "type",
        "use_declaration": "import",
    },
    "java": {
        "method_declaration": "method",
        "class_declaration": "class",
        "interface_declaration": "type",
        "import_declaration": "import",
    },
    "ruby": {
        "method": "function",
        "class": "class",
        "module": "class",
    },
}

# Node types that contribute to cyclomatic complexity
_COMPLEXITY_NODES: set[str] = {
    "if_statement",
    "if_expression",
    "elif_clause",
    "else_clause",
    "for_statement",
    "for_in_statement",
    "for_expression",
    "while_statement",
    "while_expression",
    "try_statement",
    "try_expression",
    "catch_clause",
    "except_clause",
    "switch_statement",
    "switch_expression",
    "match_expression",
    "match_arm",
    "case_clause",
    "ternary_expression",
    "conditional_expression",
    "binary_expression",  # counted only for && / ||
    "boolean_operator",
}


@dataclass
class Symbol:
    """A code symbol extracted from an AST."""

    name: str
    kind: str  # function, class, method, import, export, type
    line_start: int
    line_end: int
    docstring: str | None
    parameters: list[str] = field(default_factory=list)
    return_type: str | None = None
    language: str = ""


class ASTExtractor:
    """Extracts symbols and structural information from source code via tree-sitter."""

    def __init__(self) -> None:
        self._parsers: dict[str, ts.Parser] = {}
        self._languages: dict[str, ts.Language] = {}

    # ------------------------------------------------------------------
    # Language loading (lazy)
    # ------------------------------------------------------------------

    def _ensure_language(self, language: str) -> ts.Language | None:
        """Lazy-load and cache a tree-sitter language grammar."""
        if language in self._languages:
            return self._languages[language]

        loader_map: dict[str, tuple[str, str]] = {
            "python": ("tree_sitter_python", "language"),
            "typescript": ("tree_sitter_typescript", "language_typescript"),
            "javascript": ("tree_sitter_javascript", "language"),
            "go": ("tree_sitter_go", "language"),
            "rust": ("tree_sitter_rust", "language"),
            "java": ("tree_sitter_java", "language"),
            "ruby": ("tree_sitter_ruby", "language"),
        }

        spec = loader_map.get(language)
        if spec is None:
            logger.warning("No grammar mapping for language: %s", language)
            return None

        module_name, func_name = spec
        try:
            import importlib

            mod = importlib.import_module(module_name)
            lang_fn = getattr(mod, func_name)
            lang = ts.Language(lang_fn())
            self._languages[language] = lang
            return lang
        except Exception:
            logger.warning(
                "Could not load tree-sitter grammar for %s", language, exc_info=True
            )
            return None

    def _get_parser(self, language: str) -> ts.Parser | None:
        """Return a cached parser for the given language."""
        if language in self._parsers:
            return self._parsers[language]

        lang = self._ensure_language(language)
        if lang is None:
            return None

        parser = ts.Parser(lang)
        self._parsers[language] = parser
        return parser

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def detect_language(self, filename: str) -> str | None:
        """Detect language from file extension."""
        import os

        _, ext = os.path.splitext(filename)
        return _EXT_MAP.get(ext.lower())

    def parse_file(self, content: bytes, language: str) -> ts.Node | None:
        """Parse source bytes and return the root AST node."""
        parser = self._get_parser(language)
        if parser is None:
            return None
        tree = parser.parse(content)
        return tree.root_node

    def extract_symbols(
        self, root: ts.Node, language: str, *, source: bytes | None = None
    ) -> list[Symbol]:
        """Walk the AST and extract function/class/method/import symbols."""
        type_map = _SYMBOL_NODE_TYPES.get(language, {})
        symbols: list[Symbol] = []
        self._walk_for_symbols(root, language, type_map, symbols, source)
        return symbols

    def extract_structure(self, root: ts.Node) -> dict:
        """Return structural metrics about the AST."""
        total_nodes = 0
        max_depth = 0
        type_counts: Counter[str] = Counter()

        stack: list[tuple[ts.Node, int]] = [(root, 0)]
        while stack:
            node, depth = stack.pop()
            total_nodes += 1
            if depth > max_depth:
                max_depth = depth
            type_counts[node.type] += 1
            for child in node.children:
                stack.append((child, depth + 1))

        return {
            "total_nodes": total_nodes,
            "max_depth": max_depth,
            "node_type_counts": type_counts,
        }

    def compute_complexity(self, root: ts.Node) -> float:
        """Compute a cyclomatic-complexity proxy by counting branch/loop nodes."""
        complexity = 1.0  # base complexity
        stack: list[ts.Node] = [root]
        while stack:
            node = stack.pop()
            if node.type in _COMPLEXITY_NODES:
                # For binary_expression / boolean_operator, only count && / ||
                if node.type in ("binary_expression", "boolean_operator"):
                    op_node = node.child_by_field_name("operator")
                    if op_node is not None:
                        op_text = op_node.type
                        if op_text in ("&&", "||", "and", "or"):
                            complexity += 1.0
                    else:
                        # boolean_operator in Python uses "and"/"or" as the node type
                        # of the operator child — check children directly
                        for child in node.children:
                            if child.type in ("and", "or", "&&", "||"):
                                complexity += 1.0
                                break
                else:
                    complexity += 1.0
            for child in node.children:
                stack.append(child)
        return complexity

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _walk_for_symbols(
        self,
        node: ts.Node,
        language: str,
        type_map: dict[str, str],
        out: list[Symbol],
        source: bytes | None,
    ) -> None:
        """Recursively walk the AST collecting symbols."""
        if node.type in type_map:
            kind = type_map[node.type]
            sym = self._node_to_symbol(node, kind, language, source)
            if sym is not None:
                out.append(sym)

        for child in node.children:
            self._walk_for_symbols(child, language, type_map, out, source)

    def _node_to_symbol(
        self,
        node: ts.Node,
        kind: str,
        language: str,
        source: bytes | None,
    ) -> Symbol | None:
        """Convert an AST node into a Symbol dataclass."""
        # Handle decorated definitions (Python)
        actual = node
        if node.type == "decorated_definition":
            for child in node.children:
                if child.type in ("function_definition", "class_definition"):
                    actual = child
                    kind = (
                        "function"
                        if child.type == "function_definition"
                        else "class"
                    )
                    break
            else:
                return None

        # Handle export_statement wrapping (TS/JS)
        if node.type == "export_statement":
            inner = self._unwrap_export(node)
            if inner is not None:
                inner_kind = _SYMBOL_NODE_TYPES.get(language, {}).get(
                    inner.type, "export"
                )
                return self._node_to_symbol(inner, inner_kind, language, source)
            # Plain export without inner declaration
            name = self._extract_source_text(node, source) or "export"
            return Symbol(
                name=name,
                kind="export",
                line_start=node.start_point[0] + 1,
                line_end=node.end_point[0] + 1,
                docstring=None,
                language=language,
            )

        name = self._extract_name(actual, language, source)
        if name is None:
            return None

        # Detect if this is a method (function inside a class)
        if kind == "function" and self._is_method(actual):
            kind = "method"

        parameters = self._extract_parameters(actual, source)
        return_type = self._extract_return_type(actual, source)
        docstring = self._extract_docstring(actual, language, source)

        return Symbol(
            name=name,
            kind=kind,
            line_start=node.start_point[0] + 1,
            line_end=node.end_point[0] + 1,
            docstring=docstring,
            parameters=parameters,
            return_type=return_type,
            language=language,
        )

    @staticmethod
    def _unwrap_export(node: ts.Node) -> ts.Node | None:
        """Unwrap an export_statement to find the inner declaration."""
        for child in node.children:
            if child.type in (
                "function_declaration",
                "class_declaration",
                "type_alias_declaration",
                "interface_declaration",
                "lexical_declaration",
            ):
                return child
        return None

    @staticmethod
    def _is_method(node: ts.Node) -> bool:
        """Check whether a function node is inside a class body."""
        parent = node.parent
        while parent is not None:
            if parent.type in ("class_body", "class_definition", "impl_item"):
                return True
            parent = parent.parent
        return False

    @staticmethod
    def _extract_name(
        node: ts.Node, language: str, source: bytes | None
    ) -> str | None:
        """Extract the symbol name from an AST node."""
        # Try the 'name' field first (works for most languages)
        name_node = node.child_by_field_name("name")
        if name_node is not None:
            if source is not None:
                return source[name_node.start_byte : name_node.end_byte].decode(
                    "utf-8", errors="replace"
                )
            return name_node.text.decode("utf-8", errors="replace") if name_node.text else None

        # For import statements, return the full text
        if node.type in (
            "import_statement",
            "import_from_statement",
            "import_declaration",
            "use_declaration",
        ):
            if source is not None:
                text = source[node.start_byte : node.end_byte].decode(
                    "utf-8", errors="replace"
                )
            else:
                text = (
                    node.text.decode("utf-8", errors="replace")
                    if node.text
                    else None
                )
            if text:
                return text.strip().split("\n")[0][:120]
            return None

        # For Go type_declaration, look inside type_spec children
        if node.type == "type_declaration":
            for child in node.children:
                if child.type == "type_spec":
                    inner_name = child.child_by_field_name("name")
                    if inner_name is not None:
                        if source is not None:
                            return source[
                                inner_name.start_byte : inner_name.end_byte
                            ].decode("utf-8", errors="replace")
                        return (
                            inner_name.text.decode("utf-8", errors="replace")
                            if inner_name.text
                            else None
                        )

        return None

    @staticmethod
    def _extract_parameters(node: ts.Node, source: bytes | None) -> list[str]:
        """Extract parameter names from a function/method node."""
        params: list[str] = []
        params_node = node.child_by_field_name("parameters")
        if params_node is None:
            # Try formal_parameters (TypeScript/JavaScript)
            for child in node.children:
                if child.type in ("parameters", "formal_parameters"):
                    params_node = child
                    break

        if params_node is None:
            return params

        for child in params_node.children:
            if child.type in (
                "identifier",
                "typed_parameter",
                "default_parameter",
                "typed_default_parameter",
                "required_parameter",
                "optional_parameter",
                "rest_parameter",
                "parameter_declaration",
            ):
                name_node = child.child_by_field_name("name") or (
                    child
                    if child.type == "identifier"
                    else (child.children[0] if child.children else None)
                )
                if name_node is not None:
                    if source is not None:
                        text = source[
                            name_node.start_byte : name_node.end_byte
                        ].decode("utf-8", errors="replace")
                    else:
                        text = (
                            name_node.text.decode("utf-8", errors="replace")
                            if name_node.text
                            else ""
                        )
                    if text and text not in ("(", ")", ",", "self", "cls"):
                        params.append(text)

        return params

    @staticmethod
    def _extract_return_type(node: ts.Node, source: bytes | None) -> str | None:
        """Extract the return type annotation if present."""
        ret = node.child_by_field_name("return_type")
        if ret is None:
            # Look for type_annotation after parameters (TypeScript)
            for child in node.children:
                if child.type == "type_annotation":
                    ret = child
                    break

        if ret is None:
            return None

        if source is not None:
            text = source[ret.start_byte : ret.end_byte].decode(
                "utf-8", errors="replace"
            )
        else:
            text = (
                ret.text.decode("utf-8", errors="replace") if ret.text else None
            )

        if text:
            # Strip leading "-> " or ": "
            text = text.lstrip(": ").lstrip("-> ").strip()
            return text if text else None
        return None

    @staticmethod
    def _extract_docstring(
        node: ts.Node, language: str, source: bytes | None
    ) -> str | None:
        """Extract a docstring or preceding comment for a symbol."""

        def _get_text(n: ts.Node) -> str:
            if source is not None:
                return source[n.start_byte : n.end_byte].decode(
                    "utf-8", errors="replace"
                )
            return n.text.decode("utf-8", errors="replace") if n.text else ""

        # Python: first child of body that is expression_statement containing a string
        if language == "python":
            body = node.child_by_field_name("body")
            if body is not None and body.child_count > 0:
                first = body.children[0]
                if first.type == "expression_statement" and first.child_count > 0:
                    str_node = first.children[0]
                    if str_node.type == "string":
                        raw = _get_text(str_node)
                        return raw.strip("\"'").strip()

        # Check for preceding comment
        prev = node.prev_named_sibling
        if prev is not None and prev.type in ("comment", "line_comment", "block_comment"):
            return _get_text(prev).lstrip("/#* ").strip()

        return None

    @staticmethod
    def _extract_source_text(node: ts.Node, source: bytes | None) -> str | None:
        """Get the full source text of a node."""
        if source is not None:
            return source[node.start_byte : node.end_byte].decode(
                "utf-8", errors="replace"
            )
        return (
            node.text.decode("utf-8", errors="replace") if node.text else None
        )
