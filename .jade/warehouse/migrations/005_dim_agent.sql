-- 005_dim_agent.sql — Agent dimension
--
-- UDA metamodel projection: .jade/agents/crawl-agent.ts -> Postgres dim_agent
-- Grain: one row per agent definition (spider, LLM sub-agent, orchestrator)
-- Conformed: shared by fact_crawl_event, fact_dispatch, fact_quality_check
-- Cube.js semantic: ../cube/dim_agent.yml

CREATE TYPE agent_type_enum AS ENUM (
    'scrapy_spider',
    'crawlee_crawler',
    'llm_sub_agent',
    'orchestrator',
    'quality_checker'
);

CREATE TABLE dim_agent (
    agent_key           SERIAL          PRIMARY KEY,
    agent_id            VARCHAR(100)    NOT NULL UNIQUE,   -- natural key
    agent_type          agent_type_enum NOT NULL,
    agent_version       VARCHAR(30),
    model_name          VARCHAR(100),                      -- e.g. 'claude-opus-4-6'
    model_routing_tier  VARCHAR(20),                       -- 'haiku','sonnet','opus'
    concurrency_limit   SMALLINT,
    description         TEXT
);

COMMENT ON TABLE dim_agent IS
    'Conformed agent dimension. Tracks Scrapy spiders, Crawlee crawlers, '
    'LLM sub-agents, and orchestrator processes. '
    'model_routing_tier maps to the haiku/sonnet/opus cost tier for budget tracking.';

-- Seed with known agents
INSERT INTO dim_agent (agent_id, agent_type, model_routing_tier, description) VALUES
    ('crawl-orchestrator', 'orchestrator', 'opus', 'Main dispatch orchestrator'),
    ('session-start-hook', 'orchestrator', 'haiku', 'Session-start validation hook'),
    ('pre-commit-hook', 'orchestrator', 'sonnet', 'Pre-commit code review hook'),
    ('pre-pr-hook', 'orchestrator', 'opus', 'Pre-PR comprehensive review hook');
