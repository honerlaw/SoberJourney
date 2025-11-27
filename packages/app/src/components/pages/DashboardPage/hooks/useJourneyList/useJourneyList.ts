import { useReportError } from "@/src/hooks/useReportError/useReportError";
import { useTRPC } from "@/src/providers/TRPCProvider/TRPCProvider";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

export function useJourneyList() {
    const { report } = useReportError()
    const trpc = useTRPC()

    const { data, error, isLoading } = useQuery(
        trpc.journey.list.queryOptions()
    )

    useEffect(() => {
        if (error) {
            report(error)
        }
    }, [error, report])

    return {
        journeys: data?.journeys ?? [],
        error,
        isLoading,
    }
}