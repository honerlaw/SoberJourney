import { useToastError } from "@/src/hooks/useToastError";
import { useTRPC } from "@/src/providers/TRPCProvider";
import { useMutation } from "@tanstack/react-query";

export function useCreateJournalEntry() {
  const trpc = useTRPC();
  const { handleError } = useToastError();

  const { mutateAsync, isPending } = useMutation(
    trpc.journal.create.mutationOptions()
  );

  return {
    createEntry: async (content: string) => {
      try {
        await mutateAsync({
          content,
        });
        return true;
      } catch (error) {
        handleError(error, "Failed to create journal entry.");
      }
      return false;
    },
    isPending,
  };
}

