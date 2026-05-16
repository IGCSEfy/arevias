import { MockAdapter } from "./mock";
import type { AiAdapter } from "./types";

export const ai: AiAdapter = new MockAdapter();
export type { AiAdapter };
