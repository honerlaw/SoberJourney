import { type Message } from "../../hooks/useConversation";

export const mockChatMessage: Message = {
  id: "mock-comprehensive-markdown-message",
  createdAt: new Date(),
  role: "MODEL",
  content: `# H1 Heading - Main Title

## H2 Heading - Section Header

### H3 Heading - Subsection 

#### H4 Heading - Sub-subsection

##### H5 Heading - Minor Section

###### H6 Heading - Smallest Header

---

## Text Formatting

This is a **regular paragraph** with various formatting options. You can make text **bold** using double asterisks, or make it *italic* using single asterisks. You can also combine them like ***bold and italic***.

Here's a paragraph with some \`inline code\` that might reference a variable like \`userName\` or a function call like \`getUserData()\`.

---

## Code Blocks

Here's a JavaScript code block:

\`\`\`javascript
function calculateTotal(items) {
  const total = items.reduce((sum, item) => {
    return sum + (item.price * item.quantity);
  }, 0);
  
  return {
    subtotal: total,
    tax: total * 0.08,
    total: total * 1.08
  };
}
\`\`\`

Here's a TypeScript example:

\`\`\`typescript
type User = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

const createUser = async (userData: Partial<User>): Promise<User> => {
  const newUser: User = {
    id: generateId(),
    name: userData.name || 'Unknown',
    email: userData.email || '',
    isActive: true
  };
  
  return await database.users.create(newUser);
};
\`\`\`

Plain code block without syntax highlighting:
\`\`\`
SELECT * FROM users 
WHERE created_at > '2023-01-01' 
  AND status = 'active'
ORDER BY created_at DESC
LIMIT 10;
\`\`\`

---

## Lists

### Unordered Lists

- First item in bullet list
- Second item with **bold text**
- Third item with *italic text*
  - Nested bullet point
  - Another nested item with \`inline code\`
    - Even deeper nesting
- Fourth item with a [link to documentation](https://example.com)

### Ordered Lists

1. First numbered item
2. Second item with detailed explanation
3. Third item containing:
   1. Nested numbered item
   2. Another nested item
   3. Third nested with **formatting**
4. Fourth item with code: \`const result = processData(input);\`

---

## Blockquotes

> This is a blockquote that might contain important information or a quote from someone.

> **Pro tip:** You can also have blockquotes with **bold text**, *italic text*, and even \`inline code\` within them.
> 
> Multi-line blockquotes are also supported and can span multiple paragraphs for longer quotes or important notes.

---

## Links and References

Here are some example links:
- [External website](https://example.com)
- [Documentation link](https://docs.example.com/api)  
- [GitHub repository](https://github.com/user/repo)
- Email: [contact@example.com](mailto:contact@example.com)

---

## Mixed Content Examples

### Complex List with Code

1. **Setup the project:**
   \`\`\`bash
   npm install react-native-markdown-display
   \`\`\`

2. **Configure the component:**
   \`\`\`jsx
   import Markdown from 'react-native-markdown-display';
   
   const MyComponent = () => (
     <Markdown style={customStyles}>
       {markdownContent}
     </Markdown>
   );
   \`\`\`

3. **Test the implementation** with various markdown features

### Combining Quotes and Lists

> **Important considerations:**
> 
> - Always validate user input
> - Use proper error handling
> - Follow security best practices
> 
> Remember that \`sanitization\` is crucial when dealing with user-generated content.

---

## Technical Examples

### API Response Structure

\`\`\`json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "usr_123",
        "name": "John Doe",
        "email": "john@example.com",
        "preferences": {
          "theme": "dark",
          "notifications": true
        }
      }
    ]
  },
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10
  }
}
\`\`\`

### Error Handling Pattern

When implementing error handling, consider this approach:

\`\`\`typescript
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  console.error('Operation failed:', error);
  return { 
    success: false, 
    error: error instanceof Error ? error.message : 'Unknown error'
  };
}
\`\`\`

---

This comprehensive example demonstrates all the markdown formatting supported by the MessageBubble component, including headers, text formatting, code blocks, lists, blockquotes, links, and horizontal rules.`,
};

export const mockUserMessage: Message = {
  id: "mock-user-message",
  createdAt: new Date(),
  role: "USER",
  content: `Can you help me understand how to implement **markdown rendering** in React Native? 

I need to support:
1. Headers and text formatting
2. Code blocks with syntax highlighting  
3. Lists and blockquotes

Here's what I'm working with:
\`\`\`javascript
const markdownContent = "# Hello World\\n\\nThis is **bold** text.";
\`\`\`

Thanks!`,
};

export const mockSystemMessage: Message = {
  id: "mock-system-message",
  createdAt: new Date(),
  role: "MODEL",
  content: `**System:** You are now connected to the AI assistant. 

Available features:
- Natural language processing
- Code analysis and generation
- Technical documentation assistance
- *Real-time* problem solving

Type your questions or requests to get started.`,
};

export const mockErrorMessage: Message = {
  id: "mock-error-message",
  createdAt: new Date(),
  role: "MODEL",
  content: `I apologize, but I encountered an error while processing your request.

**Error Details:**
- Connection timeout after 30 seconds
- Unable to reach the API endpoint
- Please check your internet connection

**Suggested Actions:**
1. Refresh the page
2. Check your network connection  
3. Try again in a few moments

If the problem persists, please contact support at \`support@example.com\`.`,
};

export const allMockMessages: Message[] = [
  mockChatMessage,
  mockUserMessage,
  mockSystemMessage,
  mockErrorMessage,
];
