import { LLMResponse } from '../llm.service';

export class LlmCompletionEvent {
  public static readonly eventName = 'llm.completion';

  constructor(public readonly response: LLMResponse) {}
}
