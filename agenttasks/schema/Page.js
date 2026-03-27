cube('Page', {
  sql: `SELECT * FROM reporting.dim_page WHERE is_current = true`,

  measures: {
    count: {
      type: 'count',
    },
  },

  dimensions: {
    pageSk: {
      sql: 'page_sk',
      type: 'number',
      primaryKey: true,
    },
    url: {
      sql: 'url',
      type: 'string',
    },
    domain: {
      sql: 'domain',
      type: 'string',
    },
    pageType: {
      sql: 'page_type',
      type: 'string',
    },
    firstSeen: {
      sql: 'first_seen',
      type: 'time',
    },
    lastSeen: {
      sql: 'last_seen',
      type: 'time',
    },
  },
});
