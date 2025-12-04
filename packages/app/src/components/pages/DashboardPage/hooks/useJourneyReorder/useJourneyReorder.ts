import { useToastError } from "@/src/hooks/useToastError";
import { useTRPC } from "@/src/providers/TRPCProvider";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type ReorderItem = {
  id: string;
  position: number;
};

export function useJourneyReorder() {
  const { handleError } = useToastError();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { mutateAsync, isPending } = useMutation(
    trpc.journey.reorder.mutationOptions()
  );

  return {
    isPending,
    reorderJourneys: async (items: ReorderItem[]) => {
      try {
        await mutateAsync({ items });
        // Invalidate the journey list query to refetch with new order
        await queryClient.invalidateQueries({
          queryKey: trpc.journey.list.queryKey(),
        });
        return true;
      } catch (error) {
        handleError(error, "Failed to reorder journeys.");
      }
      return false;
    },
  };
}

