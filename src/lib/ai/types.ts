export type AiRole = "user" | "ai";

export type AiReplyContext = {
  id?: string;
  role: AiRole;
  text: string;
};

export type AiHistoryMessage = {
  id?: string;
  role: AiRole;
  text: string;
  replyTo?: AiReplyContext;
};

export type AiReplyRequest = {
  message: string;
  history?: AiHistoryMessage[];
  replyTo?: AiReplyContext | null;
};

export type AiReplyResponse = {
  text: string;
};

export type AiAdapter = {
  /** Returns 1, 2, or 3 short message fragments. May be sync or async. */
  generateReplyParts(input: AiReplyRequest): string[] | Promise<string[]>;
};
