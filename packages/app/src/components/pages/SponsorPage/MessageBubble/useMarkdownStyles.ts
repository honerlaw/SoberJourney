import { useMemo } from "react";
import { useTheme } from "tamagui";

export function useMarkdownStyles() {
  const theme = useTheme();

  return useMemo(
    () => ({
      body: {
        color: theme.color?.val || "#000",
        fontSize: 16,
        fontFamily:
          'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        lineHeight: 24,
      },
      heading1: {
        color: theme.color12?.val || theme.color?.val || "#000",
        fontSize: 28,
        fontWeight: "600" as const,
        marginTop: 12,
        marginBottom: 12,
        lineHeight: 32,
      },
      heading2: {
        color: theme.color12?.val || theme.color?.val || "#000",
        fontSize: 24,
        fontWeight: "600" as const,
        marginTop: 12,
        marginBottom: 8,
        lineHeight: 28,
      },
      heading3: {
        color: theme.color12?.val || theme.color?.val || "#000",
        fontSize: 20,
        fontWeight: "600" as const,
        marginTop: 8,
        marginBottom: 8,
        lineHeight: 24,
      },
      heading4: {
        color: theme.color12?.val || theme.color?.val || "#000",
        fontSize: 18,
        fontWeight: "600" as const,
        marginTop: 8,
        marginBottom: 4,
      },
      heading5: {
        color: theme.color12?.val || theme.color?.val || "#000",
        fontSize: 16,
        fontWeight: "600" as const,
        marginTop: 8,
        marginBottom: 4,
      },
      heading6: {
        color: theme.color11?.val || theme.color?.val || "#666",
        fontSize: 16,
        fontWeight: "600" as const,
        marginTop: 4,
        marginBottom: 4,
      },
      paragraph: {
        color: theme.color?.val || "#000",
        fontSize: 16,
        lineHeight: 24,
        marginBottom: 12,
      },
      strong: {
        fontWeight: "600" as const,
        color: theme.color12?.val || theme.color?.val || "#000",
      },
      em: {
        fontStyle: "italic" as const,
        color: theme.color11?.val || theme.color?.val || "#666",
      },
      code_inline: {
        backgroundColor: theme.gray3?.val || "rgba(0,0,0,0.05)",
        color: theme.color12?.val || theme.color?.val || "#000",
        fontFamily:
          'SF Mono, Monaco, Inconsolata, "Roboto Mono", Consolas, "Liberation Mono", Menlo, Courier, monospace',
        fontSize: 14,
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
      },
      code_block: {
        backgroundColor: theme.gray2?.val || "rgba(0,0,0,0.03)",
        color: theme.color12?.val || theme.color?.val || "#000",
        fontFamily:
          'SF Mono, Monaco, Inconsolata, "Roboto Mono", Consolas, "Liberation Mono", Menlo, Courier, monospace',
        fontSize: 14,
        padding: 12,
        borderRadius: 6,
        marginVertical: 8,
        lineHeight: 20,
      },
      fence: {
        backgroundColor: theme.gray2?.val || "rgba(0,0,0,0.03)",
        color: theme.color12?.val || theme.color?.val || "#000",
        fontFamily:
          'SF Mono, Monaco, Inconsolata, "Roboto Mono", Consolas, "Liberation Mono", Menlo, Courier, monospace',
        fontSize: 14,
        padding: 12,
        borderRadius: 6,
        marginVertical: 8,
        lineHeight: 20,
      },
      blockquote: {
        backgroundColor: theme.gray2?.val || "rgba(0,0,0,0.02)",
        borderLeftColor: theme.color?.val || theme.gray8?.val || "#ccc",
        borderLeftWidth: 4,
        paddingLeft: 12,
        paddingVertical: 8,
        marginVertical: 8,
      },
      list_item: {
        color: theme.color?.val || "#000",
        fontSize: 16,
        lineHeight: 24,
        marginBottom: 4,
      },
      bullet_list: {
        marginVertical: 8,
      },
      bullet_list_icon: {
        color: theme.color?.val || "#000",
        fontSize: 48,
        lineHeight: 24,
        paddingTop: 14,
        textAlign: "center" as const,
        textAlignVertical: "center" as const,
      },
      ordered_list: {
        marginVertical: 8,
      },
      link: {
        color: theme.blue10?.val || "#007AFF",
        textDecorationLine: "underline" as const,
      },
      hr: {
        backgroundColor:
          theme.borderColor?.val || theme.gray6?.val || "#e0e0e0",
        height: 1,
        marginVertical: 16,
      },
    }),
    [theme]
  );
}

