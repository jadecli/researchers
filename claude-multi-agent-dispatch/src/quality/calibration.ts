// ─── CalibrationModel ────────────────────────────────────────────────────────
// Tracks predicted vs actual scores to calibrate future predictions.

export class CalibrationModel {
  private predictions: { predicted: number; actual: number }[] = [];

  /** Record a predicted and actual outcome pair. */
  update(predicted: number, actual: number): void {
    this.predictions.push({ predicted, actual });
  }

  /**
   * Calibrate a raw score based on historical over/under-prediction.
   * Uses linear adjustment: if we historically over-predict by X, subtract X.
   */
  calibrate(rawScore: number): number {
    if (this.predictions.length < 2) return rawScore;

    // Calculate average bias (predicted - actual)
    const totalBias = this.predictions.reduce(
      (sum, p) => sum + (p.predicted - p.actual),
      0,
    );
    const avgBias = totalBias / this.predictions.length;

    // Apply correction
    const calibrated = rawScore - avgBias;
    return Math.min(1, Math.max(0, calibrated));
  }

  /**
   * Brier score: mean squared error between predicted and actual.
   * 0 = perfect calibration, 1 = worst possible.
   */
  brierScore(): number {
    if (this.predictions.length === 0) return 0;

    const sumSquaredError = this.predictions.reduce(
      (sum, p) => sum + Math.pow(p.predicted - p.actual, 2),
      0,
    );
    return sumSquaredError / this.predictions.length;
  }

  /**
   * Get calibration curve: bucket predictions into deciles and compute
   * average predicted vs actual for each bucket.
   */
  getCalibrationCurve(): {
    bucket: number;
    avgPredicted: number;
    avgActual: number;
  }[] {
    if (this.predictions.length === 0) return [];

    const buckets = new Map<
      number,
      { predictions: number[]; actuals: number[] }
    >();

    // Create 10 buckets (0.0-0.1, 0.1-0.2, ..., 0.9-1.0)
    for (let i = 0; i < 10; i++) {
      buckets.set(i, { predictions: [], actuals: [] });
    }

    for (const p of this.predictions) {
      const bucketIdx = Math.min(9, Math.floor(p.predicted * 10));
      const bucket = buckets.get(bucketIdx)!;
      bucket.predictions.push(p.predicted);
      bucket.actuals.push(p.actual);
    }

    const curve: { bucket: number; avgPredicted: number; avgActual: number }[] =
      [];

    for (const [idx, data] of buckets.entries()) {
      if (data.predictions.length === 0) continue;

      const avgPredicted =
        data.predictions.reduce((s, v) => s + v, 0) /
        data.predictions.length;
      const avgActual =
        data.actuals.reduce((s, v) => s + v, 0) / data.actuals.length;

      curve.push({
        bucket: idx / 10,
        avgPredicted,
        avgActual,
      });
    }

    return curve.sort((a, b) => a.bucket - b.bucket);
  }

  /** Is the model well-calibrated? (Brier score < 0.1) */
  isWellCalibrated(): boolean {
    return this.brierScore() < 0.1;
  }
}
