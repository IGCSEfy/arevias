export type AiAdapter = {
  /** Returns 1, 2, or 3 short message fragments. May be sync or async. */
  generateReplyParts(input: string): string[] | Promise<string[]>;
};
