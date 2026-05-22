import { HttpAiAdapter } from "./http";
import type { AiAdapter } from "./types";

export const ai: AiAdapter = new HttpAiAdapter();
export { isFallbackReplyText } from "./types";
export type {
  AiAdapter,
  AiHistoryMessage,
  AiReplyContext,
  AiReplyRequest,
} from "./types";
