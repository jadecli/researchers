cube('CrawlQuality', {
  sql: `SELECT * FROM reporting.fact_crawl_quality`,

  joins: {
    Page: {
      relationship: 'belongsTo',
      sql: `${CUBE}.page_sk = ${Page}.page_sk`,
    },
    Round: {
      relationship: 'belongsTo',
      sql: `${CUBE}.round_sk = ${Round}.round_sk`,
    },
  },

  measures: {
    count: {
      type: 'count',
      drillMembers: [Page.url, Page.domain, overallScore],
    },
    avgQuality: {
      sql: 'overall_score',
      type: 'avg',
      format: 'percent',
    },
    totalCost: {
      sql: 'token_cost_usd',
      type: 'sum',
      format: 'currency',
    },
    pagesChanged: {
      type: 'count',
      filters: [{ sql: `${CUBE}.content_changed = true` }],
    },
    minQuality: {
      sql: 'overall_score',
      type: 'min',
    },
    maxQuality: {
      sql: 'overall_score',
      type: 'max',
    },
  },

  dimensions: {
    overallScore: {
      sql: 'overall_score',
      type: 'number',
    },
    contentChanged: {
      sql: 'content_changed',
      type: 'boolean',
    },
    createdAt: {
      sql: 'created_at',
      type: 'time',
    },
  },

  preAggregations: {
    dailyRollup: {
      type: 'rollup',
      measureReferences: ['count', 'avgQuality', 'pagesChanged'],
      timeDimensionReference: 'createdAt',
      granularity: 'day',
      refreshKey: {
        every: '1 hour',
      },
    },
  },
});
