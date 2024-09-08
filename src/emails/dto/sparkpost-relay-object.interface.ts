/**
 * Represents a single email header.
 */
interface Header {
  [key: string]: string;
}

/**
 * Represents the content parsed from the incoming message.
 */
interface Content {
  /**
   * Contents of the last text/html part of the message.
   */
  html: string;

  /**
   * Contents of the last text/plain part of the message.
   */
  text: string;

  /**
   * "Subject" header value (decoded from email).
   */
  subject: string;

  /**
   * "To" header value (decoded from email), RFC2822 address list.
   */
  to: string[];

  /**
   * "CC" header value (decoded from email), RFC2822 address list.
   */
  cc?: string[];

  /**
   * Ordered array of email top-level headers. This array preserves ordering and allows for multiple occurrences of a header (e.g. to support trace headers such as "Received").
   */
  headers: Header[];

  /**
   * Raw MIME content for an email. If the Raw MIME content contains at least one non UTF-8 encoded character, the entire email_rfc822 value will be base64 encoded and email_rfc822_is_base64 will be set to true.
   */
  email_rfc822: string;

  /**
   * Whether the email_rfc822 value is base64 encoded.
   */
  email_rfc822_is_base64: boolean;
}

/**
 * Represents the relay message.
 */
export interface RelayEmail {
  /**
   * The content parsed from the incoming message.
   */
  content: Content;

  /**
   * Customer ID of the customer that created the relay webhook.
   */
  customer_id: string;

  /**
   * Email address used to compose the "From" header.
   */
  friendly_from: string;

  /**
   * SMTP envelope "MAIL FROM", matches "Return-Path" header address.
   */
  msg_from: string;

  /**
   * SMTP envelope "RCPT TO".
   */
  rcpt_to: string;

  /**
   * ID of the relay webhook which triggered this relay message.
   */
  webhook_id: string;

  /**
   * Protocol of the originating inbound message.
   */
  protocol?: string;
}

export interface EmailRelayObject {
  msys: {
    relay_message: RelayEmail;
  };
}
