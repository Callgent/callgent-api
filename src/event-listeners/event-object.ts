export class EventObject {
  constructor(
    public readonly srcUuid: string,
    public readonly eventType: string,
    public readonly dataType: string,
    public stopPropagation = false,
    public defaultPrevented = false,
  ) {}
}
