/**
 * Session Quantification Store (In-Memory)
 * Tracks session-level running stats across all pipeline runs.
 */
class SessionTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.totalRuns = 0;
    this.totalClaimsEvaluated = 0;
    this.groundedClaimsCount = 0;
    this.hallucinatedClaimsCount = 0;
    this.sumHallucinationRates = 0;

    this.providerBreakdown = {
      claude: { runs: 0, sumRate: 0, avgRate: 0 },
      openai: { runs: 0, sumRate: 0, avgRate: 0 }
    };

    this.typeBreakdown = {
      chart_table: { runs: 0, sumRate: 0, avgRate: 0 },
      science_mc: { runs: 0, sumRate: 0, avgRate: 0 },
      paper_figure: { runs: 0, sumRate: 0, avgRate: 0 },
      user_upload: { runs: 0, sumRate: 0, avgRate: 0 }
    };

    this.history = [];
  }

  recordRun(runData) {
    const { provider, detection, question, sampleId, sampleType = 'chart_table' } = runData;
    const rate = detection.summary.hallucinationRate;
    const { totalClaims, groundedCount, hallucinatedCount } = detection.claimCheck;

    this.totalRuns += 1;
    this.totalClaimsEvaluated += totalClaims;
    this.groundedClaimsCount += groundedCount;
    this.hallucinatedClaimsCount += hallucinatedCount;
    this.sumHallucinationRates += rate;

    // Record provider stats
    const provKey = provider.toLowerCase().includes('openai') || provider.toLowerCase().includes('gpt') ? 'openai' : 'claude';
    this.providerBreakdown[provKey].runs += 1;
    this.providerBreakdown[provKey].sumRate += rate;
    this.providerBreakdown[provKey].avgRate = Number(
      (this.providerBreakdown[provKey].sumRate / this.providerBreakdown[provKey].runs).toFixed(4)
    );

    // Record evidence type breakdown stats (RQ4 comparison)
    const typeKey = (this.typeBreakdown[sampleType]) ? sampleType : 'chart_table';
    this.typeBreakdown[typeKey].runs += 1;
    this.typeBreakdown[typeKey].sumRate += rate;
    this.typeBreakdown[typeKey].avgRate = Number(
      (this.typeBreakdown[typeKey].sumRate / this.typeBreakdown[typeKey].runs).toFixed(4)
    );

    const record = {
      timestamp: new Date().toISOString(),
      question,
      sampleId,
      sampleType: typeKey,
      provider,
      hallucinationRate: rate,
      totalClaims,
      groundedCount,
      hallucinatedCount
    };

    this.history.unshift(record);
    if (this.history.length > 50) this.history.pop();

    return this.getStats();
  }

  getStats() {
    const overallAvgRate = this.totalRuns > 0
      ? Number((this.sumHallucinationRates / this.totalRuns).toFixed(4))
      : 0;

    return {
      totalRuns: this.totalRuns,
      overallAverageHallucinationRate: overallAvgRate,
      overallAverageHallucinationPercentage: (overallAvgRate * 100).toFixed(1) + '%',
      totalClaimsEvaluated: this.totalClaimsEvaluated,
      groundedClaimsCount: this.groundedClaimsCount,
      hallucinatedClaimsCount: this.hallucinatedClaimsCount,
      providerBreakdown: {
        claude: {
          runs: this.providerBreakdown.claude.runs,
          avgRate: this.providerBreakdown.claude.avgRate,
          avgPercentage: (this.providerBreakdown.claude.avgRate * 100).toFixed(1) + '%'
        },
        openai: {
          runs: this.providerBreakdown.openai.runs,
          avgRate: this.providerBreakdown.openai.avgRate,
          avgPercentage: (this.providerBreakdown.openai.avgRate * 100).toFixed(1) + '%'
        }
      },
      typeBreakdown: {
        chart_table: {
          runs: this.typeBreakdown.chart_table.runs,
          avgRate: this.typeBreakdown.chart_table.avgRate,
          avgPercentage: (this.typeBreakdown.chart_table.avgRate * 100).toFixed(1) + '%'
        },
        science_mc: {
          runs: this.typeBreakdown.science_mc.runs,
          avgRate: this.typeBreakdown.science_mc.avgRate,
          avgPercentage: (this.typeBreakdown.science_mc.avgRate * 100).toFixed(1) + '%'
        },
        paper_figure: {
          runs: this.typeBreakdown.paper_figure.runs,
          avgRate: this.typeBreakdown.paper_figure.avgRate,
          avgPercentage: (this.typeBreakdown.paper_figure.avgRate * 100).toFixed(1) + '%'
        },
        user_upload: {
          runs: this.typeBreakdown.user_upload.runs,
          avgRate: this.typeBreakdown.user_upload.avgRate,
          avgPercentage: (this.typeBreakdown.user_upload.avgRate * 100).toFixed(1) + '%'
        }
      },
      recentRuns: this.history.slice(0, 10)
    };
  }
}

export const sessionTracker = new SessionTracker();

