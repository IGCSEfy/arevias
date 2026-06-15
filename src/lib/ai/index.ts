import { HttpAiAdapter } from "./http";
import type { AiAdapter } from "./types";

export const ai: AiAdapter = new HttpAiAdapter();
export { isFallbackReplyText } from "./types";
export { toPersonalization } from "./personalization";
export type {
  AfterthoughtDecision,
  AfterthoughtRequest,
  AiAdapter,
  AiHistoryMessage,
  AiPersonalization,
  AiReplyContext,
  AiReplyRequest,
  AiReplyResult,
  LimitReason,
} from "./types";
