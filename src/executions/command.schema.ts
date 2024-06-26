/** through `callgent` to call method/assignee, with args */
export class Invocation {
  /** callgent */
  callgent: { uuid: string; name: string };
  func: string;
  /** expression referring to callgent response data */
  args?: { [key: string]: string };
}

export type Instruction =
  | Invocation
  | Command
  | 'continue'
  | 'break'
  | 'return'
  | 'throw';
// | 'exit';

export class Command {
  /** name of command */
  name?: string;
  /** boolean expression */
  if?: string;
  /** iteration over a collection */
  for?: { exp: string; var: string };
  /** boolean expression */
  while?: string;
  /** Instruction flow */
  exec: Instruction | Instruction[];
  /** Instruction flow */
  else?: Instruction | Instruction[];
  pseudo? = false;
}

// invocation produce variable data,
// invocation refer to data by expressions,
// list of instructions as a command

// ask a callgent to do sth, on some event:
// callgent.register event do: callgent.act(args)
// ask a callgent to do sth, on some condition:
// when resp.?, then callgent.act(args)

// guys, please send an email at 3pm to xx, ask him whether and where want to go
// if yes, book a table at where he want to go
// TODO callgent routing

// @b.observe('time event', '3pm', [
//   b_mail_send = @b_mail.act('send', { to: 'xx', subject: 'ask whether and where want to go' }),
//   if b_mail_send.resp.yes, then b_table_book = @b_table.act('book', { where: b_mail_send.resp.where })
// ])

// 1. callgent routing
// 2. entry routing
// 3. args mapping/generation, progressively
// 4. invocation
