import { LLMResponse } from '../llm.service';

export class LlmCompletionEvent {
  public static readonly eventName = 'llm.completion' as const;

  constructor(public readonly response: LLMResponse) {}
}
