cube('Round', {
  sql: `SELECT * FROM reporting.dim_round`,

  measures: {
    count: {
      type: 'count',
    },
  },

  dimensions: {
    roundSk: {
      sql: 'round_sk',
      type: 'number',
      primaryKey: true,
    },
    roundNumber: {
      sql: 'round_number',
      type: 'number',
    },
    roundName: {
      sql: 'round_name',
      type: 'string',
    },
    goal: {
      sql: 'goal',
      type: 'string',
    },
    qualityThreshold: {
      sql: 'quality_threshold',
      type: 'number',
    },
    startedAt: {
      sql: 'started_at',
      type: 'time',
    },
    completedAt: {
      sql: 'completed_at',
      type: 'time',
    },
  },
});
