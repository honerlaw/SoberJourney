import { useToastController } from "@tamagui/toast";
import { useReportError } from "../useReportError";
import { isTRPCClientError } from "@trpc/client";

export function useToastError() {
  const { report } = useReportError();
  const toast = useToastController();

  return {
    handleError: (error: unknown, fallbackMessage?: string) => {
      report(error);
      if (isTRPCClientError(error)) {
        const errorMessages = JSON.parse(error.message);
        if (Array.isArray(errorMessages) && errorMessages.length > 0) {
          const messObj = errorMessages[0];
          toast.show(messObj.message, {
            type: "error",
            native: false,
          });
        }
      } else if (fallbackMessage) {
        toast.show(fallbackMessage, {
          type: "error",
          native: false,
        });
      }
    },
  };
}
