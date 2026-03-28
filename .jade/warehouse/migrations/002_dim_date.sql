-- 002_dim_date.sql — Kimball standard date dimension
--
-- Grain: one row per calendar date
-- Conformed: shared by fact_crawl_event, fact_dispatch, fact_quality_check
-- Cube.js semantic: ../cube/dim_date.yml

CREATE TABLE dim_date (
    date_key        INT         PRIMARY KEY,  -- YYYYMMDD integer key
    full_date       DATE        NOT NULL UNIQUE,
    day_of_week     SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    day_name        VARCHAR(10) NOT NULL,
    day_of_month    SMALLINT    NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
    day_of_year     SMALLINT    NOT NULL CHECK (day_of_year BETWEEN 1 AND 366),
    month           SMALLINT    NOT NULL CHECK (month BETWEEN 1 AND 12),
    month_name      VARCHAR(10) NOT NULL,
    quarter         SMALLINT    NOT NULL CHECK (quarter BETWEEN 1 AND 4),
    year            SMALLINT    NOT NULL,
    is_weekend      BOOLEAN     NOT NULL,
    iso_week        SMALLINT    NOT NULL CHECK (iso_week BETWEEN 1 AND 53)
);

COMMENT ON TABLE dim_date IS 'Kimball conformed date dimension. One row per calendar date. Shared across all fact tables.';

-- Populate 10 years: 2024-01-01 through 2033-12-31
INSERT INTO dim_date (date_key, full_date, day_of_week, day_name, day_of_month, day_of_year,
                      month, month_name, quarter, year, is_weekend, iso_week)
SELECT
    TO_CHAR(d, 'YYYYMMDD')::INT                        AS date_key,
    d                                                    AS full_date,
    EXTRACT(ISODOW FROM d)::SMALLINT                    AS day_of_week,
    TO_CHAR(d, 'Day')                                   AS day_name,
    EXTRACT(DAY FROM d)::SMALLINT                       AS day_of_month,
    EXTRACT(DOY FROM d)::SMALLINT                       AS day_of_year,
    EXTRACT(MONTH FROM d)::SMALLINT                     AS month,
    TO_CHAR(d, 'Month')                                 AS month_name,
    EXTRACT(QUARTER FROM d)::SMALLINT                   AS quarter,
    EXTRACT(YEAR FROM d)::SMALLINT                      AS year,
    EXTRACT(ISODOW FROM d) IN (6, 7)                    AS is_weekend,
    EXTRACT(WEEK FROM d)::SMALLINT                      AS iso_week
FROM generate_series('2024-01-01'::DATE, '2033-12-31'::DATE, '1 day'::INTERVAL) AS d;
