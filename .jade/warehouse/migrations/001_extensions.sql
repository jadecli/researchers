-- 001_extensions.sql — Enable Neon Postgres 18 extensions
--
-- pg_graphql:  Auto-generate GraphQL API from table schemas (UDA projection layer)
-- timescaledb: Hypertables for time-series crawl event data
-- pg_cron:     Schedule maintenance jobs (VACUUM, partition cleanup)
-- pg_partman:  Automatic table partitioning for fact tables

-- Core UDA projection layer
CREATE EXTENSION IF NOT EXISTS pg_graphql;

-- Time-series and partitioning for high-volume crawl events
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pg_partman;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Utility
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
