import { useReportError } from "@/src/hooks/useReportError";
import { useTRPC } from "@/src/providers/TRPCProvider";
import { useToastController } from "@tamagui/toast";
import { useMutation } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";

export function useCreateJourney() {
  const trpc = useTRPC();
  const { report } = useReportError();
  const toast = useToastController()

  const { mutateAsync, isPending, error } = useMutation(
    trpc.journey.create.mutationOptions()
  );

  return {
    createJourney: async (title: string, startDateTime: Date) => {
      try {
        await mutateAsync({
          title,
          startDateTime,
        });
      } catch (error) {
        if (isTRPCClientError(error)) {
          const errorMessages = JSON.parse(error.message)
          if (Array.isArray(errorMessages) && errorMessages.length > 0) {
            const messObj = errorMessages[0]
            toast.show(messObj.message, {
              type: "error",
              native: false,
            });
          }
        } else {
          report(error);
        }
      }
    },
    isPending,
    error,
  };
}
