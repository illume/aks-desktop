// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A single data point for the scaling chart.
 */
export interface ChartDataPoint {
  /** Formatted time string including day name (e.g., "Wed, 14:00"). */
  time: string;
  /** Number of replicas at this time. */
  Replicas: number;
  /** CPU utilization percentage at this time. */
  CPU: number;
}

/**
 * Result of the useChartData hook including loading and error states.
 */
export interface UseChartDataResult {
  /** Array of chart data points in chronological order. */
  chartData: ChartDataPoint[];
  /** Whether the chart data is currently loading. */
  loading: boolean;
  /** Error message if data fetching failed, null otherwise. */
  error: string | null;
}

/**
 * Hook for scaling chart data.
 *
 * This standalone version does not include Prometheus/Azure integration.
 * Chart data will be empty until a Prometheus data source is configured.
 *
 * @param selectedDeployment - Name of the currently selected deployment.
 * @param _namespace - The Kubernetes namespace (unused without Prometheus).
 * @param _cluster - The cluster name (unused without Prometheus).
 * @param _subscription - The Azure subscription ID (unused without Prometheus).
 * @param _resourceGroupLabel - The resource group from namespace labels (unused without Prometheus).
 * @param _timeRangeSecs - How far back to query, in seconds (unused without Prometheus).
 * @param _step - Query resolution step in seconds (unused without Prometheus).
 * @returns Object containing chartData array, loading state, and error state.
 */
/* eslint-disable no-unused-vars */
export const useChartData = (
  selectedDeployment: string,
  _namespace: string,
  _cluster: string,
  _subscription: string | undefined,
  _resourceGroupLabel: string | undefined,
  _timeRangeSecs: number,
  _step: number
): UseChartDataResult => {
  /* eslint-enable no-unused-vars */
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const latestRequestIdRef = useRef(0);

  const fetchChartData = useCallback(async () => {
    const requestId = ++latestRequestIdRef.current;
    const isLatestRequest = () => latestRequestIdRef.current === requestId;
    const applyIfLatest = (callback: () => void) => {
      if (isLatestRequest()) {
        callback();
      }
    };

    if (!selectedDeployment) {
      applyIfLatest(() => {
        setChartData([]);
        setError(null);
        setLoading(false);
      });
      return;
    }

    // Without Prometheus integration, return empty chart data.
    // To enable chart data, integrate a Prometheus data source.
    applyIfLatest(() => {
      setChartData([]);
      setError(null);
      setLoading(false);
    });
  }, [selectedDeployment]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  useEffect(() => {
    return () => {
      latestRequestIdRef.current += 1;
    };
  }, []);

  return { chartData, loading, error };
};
