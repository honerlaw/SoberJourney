import React, { memo } from "react"
import { XStack, YStack, Paragraph } from "tamagui"
import Markdown from "react-native-markdown-display"
import MarkdownIt from "markdown-it"
import { type Message } from "@/src/providers/ConversationProvider"
import { useMarkdownStyles } from "./useMarkdownStyles"

const md = new MarkdownIt({ breaks: true })

export type MessageBubbleProps = {
  message: Message
}

export const MessageBubble = memo<MessageBubbleProps>(({ message }) => {
  const isUser = message.role === "USER"
  const markdownStyles = useMarkdownStyles()

  return (
    <XStack
      justifyContent={isUser ? "flex-end" : "flex-start"}
      paddingVertical={"$2"}
    >
      <YStack
        maxWidth="90%"
        paddingHorizontal="$3"
        paddingVertical={isUser ? "$2.5" : undefined}
        borderRadius="$6"
        backgroundColor={isUser ? "$color3" : "transparent"}
      >
        {isUser ? (
          // User text is shown verbatim, never interpreted as markdown.
          <Paragraph selectable>{message.content}</Paragraph>
        ) : (
          <Markdown markdownit={md} style={markdownStyles}>
            {message.content}
          </Markdown>
        )}
      </YStack>
    </XStack>
  )
})

MessageBubble.displayName = "MessageBubble"
