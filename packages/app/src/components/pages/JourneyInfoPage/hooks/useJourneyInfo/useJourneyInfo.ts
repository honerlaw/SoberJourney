import { useReportError } from "@/src/hooks/useReportError/useReportError";
import { useTRPC } from "@/src/providers/TRPCProvider/TRPCProvider";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useEffect } from "react";

type JourneyEntry = {
  id: string;
  createdAt: Date;
};

type JourneyInfo = {
  id: string;
  title: string;
  position: number;
  entries: JourneyEntry[];
  createdAt: Date;
  updatedAt: Date;
};

export function useJourneyInfo(journeyId: string) {
  const { report } = useReportError();
  const trpc = useTRPC();

  const { data, error, isLoading, isRefetching, refetch } = useQuery(
    trpc.journey.get.queryOptions(
      { journeyId },
      { enabled: !!journeyId }
    )
  );

  useFocusEffect(() => {
    if (journeyId) {
      refetch();
    }
  });

  useEffect(() => {
    if (error) {
      report(error);
    }
  }, [error, report]);

  const typedData = data as { journey: JourneyInfo } | undefined;

  return {
    journey: typedData?.journey ?? null,
    error,
    isLoading: isLoading && !isRefetching,
    refetch,
  };
}

