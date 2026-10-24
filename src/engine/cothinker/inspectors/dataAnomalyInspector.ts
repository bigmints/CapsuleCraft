import { DataAnomalyFinding, SupportedLang } from '../types';
import { mean, median, interquartileRange, standardDeviation, quantile } from 'simple-statistics';

/**
 * Scan numeric column series for plain-language anomalies using `simple-statistics` (spikes, drops, plateaus).
 * Uses Tukey's IQR rule (Q1 - 1.5*IQR, Q3 + 1.5*IQR) for statistically robust outlier detection.
 */
export function inspectDataAnomalies(
  columnName: string,
  values: number[],
  lang: SupportedLang = 'ru'
): DataAnomalyFinding[] {
  if (!values || values.length < 4) return [];

  const findings: DataAnomalyFinding[] = [];
  const n = values.length;

  const colMean = mean(values);
  const colMedian = median(values);
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = interquartileRange(sorted);
  const colStdDev = standardDeviation(values);

  // 1. Tukey's fences for robust outlier/spike detection
  const highThreshold = iqr > 0 ? q3 + 1.5 * iqr : colMean + 2 * colStdDev;
  const lowThreshold = iqr > 0 ? q1 - 1.5 * iqr : colMean - 2 * colStdDev;

  for (let i = 0; i < n; i++) {
    const val = values[i];

    if (val > highThreshold && Math.abs(val - colMedian) > 5) {
      const msg =
        lang === 'en'
          ? `Row ${i + 1} column "${columnName}" exhibits a sharp spike (${val} vs typical median ${colMedian.toFixed(1)}). Verify if this is an input typo or an extraordinary outlier event.`
          : `В строке ${i + 1} колонка «${columnName}» имеет резкий скачок (${val} при типичной медиане ${colMedian.toFixed(1)}). Проверьте, не опечатка ли это или разовое нетипичное событие.`;

      findings.push({
        column: columnName,
        type: 'spike',
        rowIndex: i + 1,
        value: val,
        expected: Math.round(colMedian * 100) / 100,
        message: msg,
      });
      break; // Report first primary spike per column
    } else if (val < lowThreshold && colMedian > 10 && val >= 0) {
      const msg =
        lang === 'en'
          ? `Row ${i + 1} column "${columnName}" exhibits an abnormal drop (${val} vs median ${colMedian.toFixed(1)}).`
          : `В строке ${i + 1} колонка «${columnName}» имеет аномальный провал (${val} при медиане ${colMedian.toFixed(1)}).`;

      findings.push({
        column: columnName,
        type: 'drop',
        rowIndex: i + 1,
        value: val,
        expected: Math.round(colMedian * 100) / 100,
        message: msg,
      });
      break;
    }
  }

  // 2. Check for plateau in the tail (last 3-4 points unchanged)
  if (n >= 5) {
    const tail = values.slice(-3);
    const tailRange = Math.max(...tail) - Math.min(...tail);
    const overallRange = Math.max(...values) - Math.min(...values);

    if (overallRange > 0 && tailRange / overallRange < 0.02) {
      const msg =
        lang === 'en'
          ? `Metric "${columnName}" has stagnated at a plateau (~${tail[0].toFixed(1)}) across the last 3 data points — growth or movement has stalled.`
          : `Показатель «${columnName}» последние 3 точки стоит на плато (~${tail[0].toFixed(1)}) — движение или рост в конце периода замедлились.`;

      findings.push({
        column: columnName,
        type: 'plateau',
        value: tail[tail.length - 1],
        message: msg,
      });
    }
  }

  return findings;
}
