-- TABLE_NAME: reporting.dim_agent
-- LOAD_TYPE: full_refresh (static seed data)
-- SCHEDULE: daily 02:00 UTC
-- START_BACKFILL_DATE: 2026-03-26
-- DEPENDS_ON: none (seed data)
-- QUALITY_CHECKS: 4 rows, no null agent_ids

TRUNCATE reporting.dim_agent CASCADE;

INSERT INTO reporting.dim_agent (agent_id, agent_name, model, capabilities) VALUES
('dispatch-orchestrator', 'Dispatch Orchestrator', 'opus',   '{"code":0.7,"research":0.9,"analysis":0.9,"creative":0.6,"safety":0.8}'),
('audit-agent',           'Audit Agent',           'sonnet', '{"code":0.5,"research":0.7,"analysis":0.9,"creative":0.3,"safety":0.9}'),
('quality-scorer',        'Quality Scorer',        'sonnet', '{"code":0.4,"research":0.6,"analysis":0.9,"creative":0.3,"safety":0.8}'),
('refinement-agent',      'Refinement Agent',      'sonnet', '{"code":0.6,"research":0.8,"analysis":0.8,"creative":0.7,"safety":0.7}');

-- QUALITY CHECKS
DO $$ BEGIN
    ASSERT (SELECT count(*) FROM reporting.dim_agent) = 4, 'FAIL: expected 4 agents';
    ASSERT (SELECT count(*) FROM reporting.dim_agent WHERE agent_id IS NULL) = 0, 'FAIL: null agent_ids';
    RAISE NOTICE 'PASS: dim_agent — 4 rows';
END $$;
