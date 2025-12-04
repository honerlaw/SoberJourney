import { useToastError } from "@/src/hooks/useToastError";
import { useTRPC } from "@/src/providers/TRPCProvider";
import { useMutation } from "@tanstack/react-query";

export function useUpdateJourney() {
  const trpc = useTRPC();
  const { handleError } = useToastError();

  const { mutateAsync, isPending } = useMutation(
    trpc.journey.update.mutationOptions()
  );

  return {
    updateJourney: async (journeyId: string, title: string) => {
      try {
        await mutateAsync({
          journeyId,
          title,
        });
        return true;
      } catch (error) {
        handleError(error, "Failed to update journey.");
      }
      return false;
    },
    isPending,
  };
}

