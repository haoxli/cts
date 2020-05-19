/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/

import { extractImportantStackTrace } from '../util/stack.js';
export class LogMessageWithStack extends Error {
  constructor(name, ex, includeStack = true) {
    super(ex.message);
    this.name = name;
    this.stack = includeStack ? ex.stack : undefined;
  }

  toJSON() {
    let m = this.name + ': ';

    if (this.stack) {
      // this.message is already included in this.stack
      m += extractImportantStackTrace(this);
    } else {
      m += this.message;
    }

    return m;
  }

}
//# sourceMappingURL=log_message.js.map