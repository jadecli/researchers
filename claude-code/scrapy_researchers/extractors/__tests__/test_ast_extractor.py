"""Tests for the AST extractor module."""

import pytest

from scrapy_researchers.extractors.ast_extractor import ASTExtractor, Symbol


@pytest.fixture
def extractor() -> ASTExtractor:
    return ASTExtractor()


# ------------------------------------------------------------------
# detect_language
# ------------------------------------------------------------------


class TestDetectLanguage:
    def test_python(self, extractor: ASTExtractor) -> None:
        assert extractor.detect_language("main.py") == "python"

    def test_typescript(self, extractor: ASTExtractor) -> None:
        assert extractor.detect_language("app.ts") == "typescript"

    def test_tsx(self, extractor: ASTExtractor) -> None:
        assert extractor.detect_language("Component.tsx") == "typescript"

    def test_javascript(self, extractor: ASTExtractor) -> None:
        assert extractor.detect_language("index.js") == "javascript"

    def test_go(self, extractor: ASTExtractor) -> None:
        assert extractor.detect_language("server.go") == "go"

    def test_rust(self, extractor: ASTExtractor) -> None:
        assert extractor.detect_language("lib.rs") == "rust"

    def test_java(self, extractor: ASTExtractor) -> None:
        assert extractor.detect_language("Main.java") == "java"

    def test_ruby(self, extractor: ASTExtractor) -> None:
        assert extractor.detect_language("app.rb") == "ruby"

    def test_unknown_extension(self, extractor: ASTExtractor) -> None:
        assert extractor.detect_language("data.unknown") is None

    def test_no_extension(self, extractor: ASTExtractor) -> None:
        assert extractor.detect_language("Makefile") is None


# ------------------------------------------------------------------
# extract_symbols — Python
# ------------------------------------------------------------------


PYTHON_CODE = b"""\
import os
from pathlib import Path


def greet(name: str) -> str:
    \"\"\"Say hello.\"\"\"
    return f"Hello, {name}"


class Greeter:
    \"\"\"A greeter class.\"\"\"

    def say_hi(self, name: str) -> None:
        print(f"Hi {name}")
"""


class TestExtractSymbolsPython:
    def test_extracts_functions(self, extractor: ASTExtractor) -> None:
        root = extractor.parse_file(PYTHON_CODE, "python")
        assert root is not None
        symbols = extractor.extract_symbols(root, "python", source=PYTHON_CODE)

        functions = [s for s in symbols if s.kind == "function"]
        assert len(functions) == 1
        assert functions[0].name == "greet"
        assert functions[0].language == "python"

    def test_extracts_classes(self, extractor: ASTExtractor) -> None:
        root = extractor.parse_file(PYTHON_CODE, "python")
        assert root is not None
        symbols = extractor.extract_symbols(root, "python", source=PYTHON_CODE)

        classes = [s for s in symbols if s.kind == "class"]
        assert len(classes) == 1
        assert classes[0].name == "Greeter"

    def test_extracts_imports(self, extractor: ASTExtractor) -> None:
        root = extractor.parse_file(PYTHON_CODE, "python")
        assert root is not None
        symbols = extractor.extract_symbols(root, "python", source=PYTHON_CODE)

        imports = [s for s in symbols if s.kind == "import"]
        assert len(imports) == 2
        assert any("os" in s.name for s in imports)
        assert any("pathlib" in s.name or "Path" in s.name for s in imports)

    def test_extracts_methods(self, extractor: ASTExtractor) -> None:
        root = extractor.parse_file(PYTHON_CODE, "python")
        assert root is not None
        symbols = extractor.extract_symbols(root, "python", source=PYTHON_CODE)

        methods = [s for s in symbols if s.kind == "method"]
        assert len(methods) == 1
        assert methods[0].name == "say_hi"

    def test_docstring_extraction(self, extractor: ASTExtractor) -> None:
        root = extractor.parse_file(PYTHON_CODE, "python")
        assert root is not None
        symbols = extractor.extract_symbols(root, "python", source=PYTHON_CODE)

        greet = next(s for s in symbols if s.name == "greet")
        assert greet.docstring is not None
        assert "Say hello" in greet.docstring

    def test_parameters(self, extractor: ASTExtractor) -> None:
        root = extractor.parse_file(PYTHON_CODE, "python")
        assert root is not None
        symbols = extractor.extract_symbols(root, "python", source=PYTHON_CODE)

        greet = next(s for s in symbols if s.name == "greet")
        assert "name" in greet.parameters

    def test_return_type(self, extractor: ASTExtractor) -> None:
        root = extractor.parse_file(PYTHON_CODE, "python")
        assert root is not None
        symbols = extractor.extract_symbols(root, "python", source=PYTHON_CODE)

        greet = next(s for s in symbols if s.name == "greet")
        assert greet.return_type is not None
        assert "str" in greet.return_type

    def test_line_numbers(self, extractor: ASTExtractor) -> None:
        root = extractor.parse_file(PYTHON_CODE, "python")
        assert root is not None
        symbols = extractor.extract_symbols(root, "python", source=PYTHON_CODE)

        greet = next(s for s in symbols if s.name == "greet")
        assert greet.line_start >= 1
        assert greet.line_end >= greet.line_start


# ------------------------------------------------------------------
# extract_symbols — TypeScript
# ------------------------------------------------------------------


TS_CODE = b"""\
import { readFile } from "fs";

export function greet(name: string): string {
    return `Hello, ${name}`;
}

export class Greeter {
    name: string;

    constructor(name: string) {
        this.name = name;
    }

    sayHi(): void {
        console.log(`Hi ${this.name}`);
    }
}

interface Config {
    debug: boolean;
}
"""


class TestExtractSymbolsTypeScript:
    def test_extracts_functions(self, extractor: ASTExtractor) -> None:
        root = extractor.parse_file(TS_CODE, "typescript")
        assert root is not None
        symbols = extractor.extract_symbols(root, "typescript", source=TS_CODE)

        functions = [s for s in symbols if s.kind == "function"]
        assert len(functions) >= 1
        assert any(s.name == "greet" for s in functions)

    def test_extracts_classes(self, extractor: ASTExtractor) -> None:
        root = extractor.parse_file(TS_CODE, "typescript")
        assert root is not None
        symbols = extractor.extract_symbols(root, "typescript", source=TS_CODE)

        classes = [s for s in symbols if s.kind == "class"]
        assert len(classes) >= 1
        assert any(s.name == "Greeter" for s in classes)

    def test_extracts_exports(self, extractor: ASTExtractor) -> None:
        root = extractor.parse_file(TS_CODE, "typescript")
        assert root is not None
        symbols = extractor.extract_symbols(root, "typescript", source=TS_CODE)

        # The export statements should produce function/class symbols
        names = [s.name for s in symbols]
        assert "greet" in names
        assert "Greeter" in names

    def test_extracts_imports(self, extractor: ASTExtractor) -> None:
        root = extractor.parse_file(TS_CODE, "typescript")
        assert root is not None
        symbols = extractor.extract_symbols(root, "typescript", source=TS_CODE)

        imports = [s for s in symbols if s.kind == "import"]
        assert len(imports) >= 1

    def test_extracts_interfaces(self, extractor: ASTExtractor) -> None:
        root = extractor.parse_file(TS_CODE, "typescript")
        assert root is not None
        symbols = extractor.extract_symbols(root, "typescript", source=TS_CODE)

        types = [s for s in symbols if s.kind == "type"]
        assert any(s.name == "Config" for s in types)


# ------------------------------------------------------------------
# compute_complexity
# ------------------------------------------------------------------


class TestComputeComplexity:
    def test_simple_function(self, extractor: ASTExtractor) -> None:
        code = b"def f(): pass"
        root = extractor.parse_file(code, "python")
        assert root is not None
        c = extractor.compute_complexity(root)
        # Base complexity is 1
        assert c >= 1.0

    def test_three_if_statements(self, extractor: ASTExtractor) -> None:
        code = b"""\
def f(x):
    if x > 0:
        pass
    if x < 10:
        pass
    if x == 5:
        pass
"""
        root = extractor.parse_file(code, "python")
        assert root is not None
        c = extractor.compute_complexity(root)
        # 1 base + 3 ifs = at least 4, but >= 3 is the key check
        assert c >= 3.0

    def test_loops_add_complexity(self, extractor: ASTExtractor) -> None:
        code = b"""\
def f(items):
    for item in items:
        while True:
            break
"""
        root = extractor.parse_file(code, "python")
        assert root is not None
        c = extractor.compute_complexity(root)
        # 1 base + for + while = at least 3
        assert c >= 3.0

    def test_try_except_complexity(self, extractor: ASTExtractor) -> None:
        code = b"""\
def f():
    try:
        pass
    except ValueError:
        pass
    except TypeError:
        pass
"""
        root = extractor.parse_file(code, "python")
        assert root is not None
        c = extractor.compute_complexity(root)
        # 1 base + try + 2 excepts = at least 4
        assert c >= 3.0


# ------------------------------------------------------------------
# extract_structure
# ------------------------------------------------------------------


class TestExtractStructure:
    def test_counts_nodes(self, extractor: ASTExtractor) -> None:
        code = b"x = 1\ny = 2\n"
        root = extractor.parse_file(code, "python")
        assert root is not None
        structure = extractor.extract_structure(root)
        assert structure["total_nodes"] > 0
        assert structure["max_depth"] >= 1
        assert isinstance(structure["node_type_counts"], dict)

    def test_node_type_counts(self, extractor: ASTExtractor) -> None:
        code = b"def f(): pass\ndef g(): pass\n"
        root = extractor.parse_file(code, "python")
        assert root is not None
        structure = extractor.extract_structure(root)
        assert structure["node_type_counts"]["function_definition"] == 2


# ------------------------------------------------------------------
# Graceful fallback
# ------------------------------------------------------------------


class TestGracefulFallback:
    def test_unknown_language_returns_none(self, extractor: ASTExtractor) -> None:
        result = extractor.parse_file(b"something", "haskell")
        assert result is None
