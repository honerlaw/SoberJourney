import { ScrollView, H1, Paragraph, YStack, Anchor } from "tamagui";
import { WebLayout } from "@/src/components/WebLayout";
import Icon from "@/assets/logo/icon.svg";

export const SupportPage = () => {
  return (
    <WebLayout>
      <ScrollView padding="$4">
        <YStack gap="$4" justifyContent="center" alignItems="center">
          <Icon width={100} height={100} />
          <H1>Support</H1>
          <Paragraph textAlign="center">
            Need help? We&apos;re here to assist you with any questions or
            issues you may have.
          </Paragraph>

          <Paragraph textAlign="center">
            Please reach out to our support team at{" "}
            <Anchor
              href="mailto:support@onerlaw.com"
              color="$primary"
              fontWeight={"600"}
            >
              support@onerlaw.com
            </Anchor>{" "}
            and we&apos;ll get back to you as soon as possible.
          </Paragraph>

          <Paragraph textAlign="center">
            When contacting support, please provide as much detail as possible
            about your issue to help us assist you more effectively.
          </Paragraph>
        </YStack>
      </ScrollView>
    </WebLayout>
  );
};
