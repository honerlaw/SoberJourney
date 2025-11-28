import { useReportError } from "@/src/hooks/useReportError";
import { useTRPC } from "@/src/providers/TRPCProvider";
import { useMutation } from "@tanstack/react-query";

export function useJourneyReset() {
  const { report } = useReportError();
  const trpc = useTRPC();

  const { mutateAsync, isPending } = useMutation(
    trpc.journey.reset.mutationOptions()
  );

  return {
    isPending,
    resetJourney: async (journeyId: string) => {
      try {
        await mutateAsync({ journeyId });
        return true;
      } catch (error) {
        report(error);
      }
      return false;
    },
  };
}
