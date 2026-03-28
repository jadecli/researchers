"""DSPy pipeline for agentcommits: commit classification and trailer extraction."""

from .classifier import CommitClassifierModule
from .trailer_extractor import TrailerExtractorModule
from .convention_checker import ConventionCheckerModule
from .bloom_index import AgentCommitBloomFilter

__all__ = [
    "CommitClassifierModule",
    "TrailerExtractorModule",
    "ConventionCheckerModule",
    "AgentCommitBloomFilter",
]
