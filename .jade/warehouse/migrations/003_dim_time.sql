-- 003_dim_time.sql — Kimball time-of-day dimension
--
-- Grain: one row per minute of the day (1440 rows)
-- Conformed: shared by all fact tables for sub-day drill-down
-- Cube.js semantic: ../cube/dim_time.yml

CREATE TABLE dim_time_of_day (
    time_key        INT         PRIMARY KEY,  -- minutes since midnight (0-1439)
    clock_time      TIME        NOT NULL UNIQUE,
    hour_24         SMALLINT    NOT NULL CHECK (hour_24 BETWEEN 0 AND 23),
    minute          SMALLINT    NOT NULL CHECK (minute BETWEEN 0 AND 59),
    am_pm           CHAR(2)     NOT NULL CHECK (am_pm IN ('AM', 'PM')),
    day_period      VARCHAR(10) NOT NULL      -- 'morning','afternoon','evening','night'
);

COMMENT ON TABLE dim_time_of_day IS 'Kimball conformed time-of-day dimension. 1440 rows (one per minute). Shared across all fact tables.';

INSERT INTO dim_time_of_day (time_key, clock_time, hour_24, minute, am_pm, day_period)
SELECT
    h * 60 + m                                          AS time_key,
    MAKE_TIME(h, m, 0)                                  AS clock_time,
    h::SMALLINT                                         AS hour_24,
    m::SMALLINT                                         AS minute,
    CASE WHEN h < 12 THEN 'AM' ELSE 'PM' END           AS am_pm,
    CASE
        WHEN h BETWEEN 6 AND 11 THEN 'morning'
        WHEN h BETWEEN 12 AND 17 THEN 'afternoon'
        WHEN h BETWEEN 18 AND 21 THEN 'evening'
        ELSE 'night'
    END                                                 AS day_period
FROM generate_series(0, 23) AS h, generate_series(0, 59) AS m;
