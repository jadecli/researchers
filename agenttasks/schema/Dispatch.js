cube('Dispatch', {
  sql: `SELECT * FROM reporting.fact_dispatch`,

  joins: {
    Round: {
      relationship: 'belongsTo',
      sql: `${CUBE}.round_sk = ${Round}.round_sk`,
    },
  },

  measures: {
    count: {
      type: 'count',
    },
    successRate: {
      type: 'count',
      filters: [{ sql: `${CUBE}.success = true` }],
    },
    totalInputTokens: {
      sql: 'input_tokens',
      type: 'sum',
    },
    totalOutputTokens: {
      sql: 'output_tokens',
      type: 'sum',
    },
    totalCost: {
      sql: 'cost_usd',
      type: 'sum',
      format: 'currency',
    },
    avgDuration: {
      sql: 'duration_ms',
      type: 'avg',
    },
  },

  dimensions: {
    taskType: {
      sql: 'task_type',
      type: 'string',
    },
    platform: {
      sql: 'platform',
      type: 'string',
    },
    qualityScore: {
      sql: 'quality_score',
      type: 'number',
    },
    success: {
      sql: 'success',
      type: 'boolean',
    },
  },
});
