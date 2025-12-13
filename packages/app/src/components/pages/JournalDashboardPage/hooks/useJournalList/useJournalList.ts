import { useReportError } from "@/src/hooks/useReportError/useReportError";
import { useTRPC } from "@/src/providers/TRPCProvider/TRPCProvider";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useEffect } from "react";

export function useJournalList() {
  const { report } = useReportError();
  const trpc = useTRPC();

  const { data, error, isLoading, isRefetching, refetch } = useQuery(
    trpc.journal.list.queryOptions()
  );

  useFocusEffect(() => {
    refetch();
  });

  useEffect(() => {
    if (error) {
      report(error);
    }
  }, [error, report]);

  return {
    entries: data?.entries ?? [],
    error,
    isLoading: isLoading && !isRefetching,
    refetch,
  };
}

