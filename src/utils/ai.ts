import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
const embeddingModel = genAI.getGenerativeModel({
  model: "text-embedding-004",
});

export const generateEmbedding = async (text: string): Promise<number[]> => {
  if (!text || text.trim().length === 0) {
    throw new Error("Text cannot be empty for embedding generation");
  }

  const maxLength = 20000;
  const truncatedText = text.slice(0, maxLength);

  try {
    const result = await embeddingModel.embedContent(truncatedText);
    return result.embedding.values;
  } catch (error) {
    console.error("Embedding generation error:", error);
    throw new Error("Failed to generate embedding");
  }
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const isFirstMessage = (history: ChatMessage[]): boolean => {
  return history.length === 0;
};

const needsExplanation = (question: string): boolean => {
  const explanationKeywords = [
    "explain",
    "what is",
    "what does",
    "how does",
    "why",
    "can you elaborate",
    "tell me more",
    "clarify",
    "what do you mean",
    "in detail",
    "break down",
    "help me understand",
  ];

  const lowerQuestion = question.toLowerCase();
  return explanationKeywords.some((keyword) => lowerQuestion.includes(keyword));
};

export const chatWithAI = async (
  context: string,
  history: ChatMessage[],
  question: string,
): Promise<string> => {
  if (!question?.trim()) {
    throw new Error("Question cannot be empty");
  }

  // Check if the input is just a greeting
  const isGreeting =
    /^(hi|hello|hey|greetings|good morning|good afternoon|good evening)\b/i.test(
      question.trim(),
    );

  if (isFirstMessage(history) && isGreeting) {
    const greetingPrompt = `You are a friendly AI assistant that helps users understand documents.

Generate a warm, professional greeting that:
1. Welcomes the user
2. Briefly mentions you can help them explore and understand the uploaded document
3. Asks how you can assist them today
4. Keep it concise (2-3 sentences max)

User's message: "${question}"`;

    try {
      const completion = await groq.chat.completions.create({
        messages: [{ role: "system", content: greetingPrompt }],
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_tokens: 300,
      });

      return (
        completion.choices[0]?.message?.content ||
        "Hello! I'm here to help you understand your document. What would you like to know?"
      );
    } catch (error) {
      console.error("Greeting error:", error);
      return "Hello! I'm here to help you understand your document. What would you like to know?";
    }
  }

  const allowExternalKnowledge = needsExplanation(question);

  const maxContextLength = 30000;
  const truncatedContext = context.slice(0, maxContextLength);

  const systemPrompt = allowExternalKnowledge
    ? `You are an expert AI assistant helping users understand documents.

MAIN GOAL: Answer based on the provided context.

INSTRUCTIONS:
1. PRIMARY SOURCE: Always prioritize and cite information from the CONTEXT below
2. EXTERNAL KNOWLEDGE: If the user asks for explanation or clarification:
   - You MAY use minimal external knowledge to explain concepts, terms, or provide analogies
   - Keep external information brief and relevant (1-2 sentences max)
   - Clearly distinguish between what's in the document vs. general explanation
   - Use phrases like "Based on the document..." vs. "Generally speaking..."
3. If the document doesn't contain the answer, clearly state that first
4. Keep your answer clear, concise, and helpful

CONTEXT FROM DOCUMENT:
"""
${truncatedContext}
"""

Remember: The document is your PRIMARY source. External knowledge should only SUPPORT understanding, not replace document content.`
    : `You are an expert AI assistant analyzing documents.

STRICT RULES:
- Answer ONLY using the provided CONTEXT below
- Do NOT use external knowledge or information not in the document
- If information is missing, respond: "I cannot find that information in the document."
- Be concise, accurate, and cite specific parts when possible

CONTEXT:
"""
${truncatedContext}
"""`;

  const chatHistory: ChatCompletionMessageParam[] = history
    .slice(-10)
    .map((msg) => ({
      role:
        msg.role === "assistant" || msg.role === "system" ? msg.role : "user",
      content: msg.content,
    }));

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        ...chatHistory,
        { role: "user", content: question },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: allowExternalKnowledge ? 0.5 : 0.3,
      max_tokens: 1024,
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      throw new Error("Empty response from model");
    }

    return response;
  } catch (error: any) {
    console.error("Groq Chat Error:", error);

    if (error?.status === 429) {
      return "Rate limit exceeded. Please try again in a moment.";
    }
    if (error?.status === 401) {
      return "API authentication failed. Please check your API key.";
    }

    throw new Error("Failed to generate AI response");
  }
};

export const chatWithAIStream = async (
  context: string,
  history: ChatMessage[],
  question: string,
  onChunk: (text: string) => void,
): Promise<void> => {
  if (!question?.trim()) {
    throw new Error("Question cannot be empty");
  }

  if (isFirstMessage(history)) {
    const greeting =
      "Hello! 👋 I'm here to help you explore and understand your document. What would you like to know?";
    onChunk(greeting);
    return;
  }

  const allowExternalKnowledge = needsExplanation(question);
  const maxContextLength = 30000;
  const truncatedContext = context.slice(0, maxContextLength);

  const systemPrompt = allowExternalKnowledge
    ? `You are an expert AI assistant helping users understand documents.

PRIMARY SOURCE: Always base answers on the provided context.
EXTERNAL KNOWLEDGE: Only when explaining concepts/terms - keep it minimal (1-2 sentences).
Distinguish clearly: "Based on the document..." vs. "Generally speaking..."

CONTEXT:
${truncatedContext}`
    : `You are an expert AI assistant analyzing documents.

STRICT: Answer ONLY from the context below. No external knowledge.

CONTEXT:
${truncatedContext}`;

  const chatHistory: ChatCompletionMessageParam[] = history
    .slice(-10)
    .map((msg) => ({
      role:
        msg.role === "assistant" || msg.role === "system" ? msg.role : "user",
      content: msg.content,
    }));

  try {
    const stream = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        ...chatHistory,
        { role: "user", content: question },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: allowExternalKnowledge ? 0.5 : 0.3,
      max_tokens: 1024,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        onChunk(content);
      }
    }
  } catch (error) {
    console.error("Streaming error:", error);
    throw new Error("Failed to stream AI response");
  }
};

export const generateEmbeddingsBatch = async (
  texts: string[],
): Promise<number[][]> => {
  if (texts.length === 0) {
    return [];
  }

  try {
    const embeddings = await Promise.all(
      texts.map((text) => generateEmbedding(text)),
    );
    return embeddings;
  } catch (error) {
    console.error("Batch embedding error:", error);
    throw new Error("Failed to generate batch embeddings");
  }
};
