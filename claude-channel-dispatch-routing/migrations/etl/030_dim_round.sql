-- TABLE_NAME: reporting.dim_round
-- LOAD_TYPE: full_refresh (static seed data)
-- SCHEDULE: daily 02:00 UTC
-- START_BACKFILL_DATE: 2026-03-26
-- DEPENDS_ON: none (seed data)
-- QUALITY_CHECKS: exactly 10 rows, no null round_names

TRUNCATE reporting.dim_round CASCADE;

INSERT INTO reporting.dim_round (round_number, round_name, goal, quality_threshold, target_repos) VALUES
(1,  'Foundation',             'Base dispatch types and unified inference',          0.60, ARRAY['safety-tooling', 'mcp-python-sdk', 'mcp-typescript-sdk']),
(2,  'Shannon Thinking',       'Structured thinking MCP server',                    0.65, ARRAY['shannon-thinking']),
(3,  'Bloom Pipeline',         'Multi-stage dispatch pipeline',                     0.65, ARRAY['bloom']),
(4,  'Petri Auditing',         'Dispatch audit system',                             0.70, ARRAY['petri']),
(5,  'Orchestrator',           'Core DispatchOrchestrator',                         0.70, ARRAY['bloom', 'petri', 'shannon-thinking']),
(6,  'GitHub Org Crawl',       'Crawl 67 repos across 3 orgs with tree-sitter AST', 0.55, ARRAY['anthropics', 'modelcontextprotocol', 'safety-research']),
(7,  'Quality Scoring',        'AST-accurate quality scoring pipeline',             0.75, ARRAY['bloom', 'petri', 'shannon-thinking']),
(8,  'Channel Infrastructure', 'MCP channel server + webhook + permission relay',   0.80, ARRAY['channels-reference']),
(9,  'Neon Persistence',       'Postgres-backed crawl cache + change detection',    0.80, ARRAY['neon-pg18']),
(10, 'Production Routing',     'Community plugin index + safety validation',        0.85, ARRAY['claude-plugins-community']);

-- QUALITY CHECKS
DO $$ BEGIN
    ASSERT (SELECT count(*) FROM reporting.dim_round) = 10,
        'FAIL: expected exactly 10 rounds';
    ASSERT (SELECT count(*) FROM reporting.dim_round WHERE round_name IS NULL) = 0,
        'FAIL: null round_names';
    RAISE NOTICE 'PASS: dim_round — 10 rows';
END $$;
