/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

import { SkipTestCase } from '../fixture.js';
import { now, assert } from '../util/util.js';
import { LogMessageWithStack } from './log_message.js';
var PassState; // Holds onto a LiveTestCaseResult owned by the Logger, and writes the results into it.

(function (PassState) {
  PassState[PassState["pass"] = 0] = "pass";
  PassState[PassState["skip"] = 1] = "skip";
  PassState[PassState["warn"] = 2] = "warn";
  PassState[PassState["fail"] = 3] = "fail";
})(PassState || (PassState = {}));

export class TestCaseRecorder {
  constructor(result, debugging) {
    _defineProperty(this, "result", void 0);

    _defineProperty(this, "state", PassState.pass);

    _defineProperty(this, "startTime", -1);

    _defineProperty(this, "logs", []);

    _defineProperty(this, "debugging", false);

    this.result = result;
    this.debugging = debugging;
  }

  start() {
    assert(this.startTime < 0, 'TestCaseRecorder cannot be reused');
    this.startTime = now();
  }

  finish() {
    assert(this.startTime >= 0, 'finish() before start()');
    const timeMilliseconds = now() - this.startTime; // Round to next microsecond to avoid storing useless .xxxx00000000000002 in results.

    this.result.timems = Math.ceil(timeMilliseconds * 1000) / 1000;
    this.result.status = PassState[this.state]; // Convert numeric enum back to string

    this.result.logs = this.logs;
  }

  injectResult(injectedResult) {
    Object.assign(this.result, injectedResult);
  }

  debug(ex) {
    if (!this.debugging) {
      return;
    }

    this.logs.push(new LogMessageWithStack('DEBUG', ex, false));
  }

  warn(ex) {
    this.setState(PassState.warn);
    this.logs.push(new LogMessageWithStack('WARN', ex));
  }

  fail(ex) {
    this.setState(PassState.fail);
    this.logs.push(new LogMessageWithStack('FAIL', ex));
  }

  skipped(ex) {
    this.setState(PassState.skip);
    this.logs.push(new LogMessageWithStack('SKIP', ex));
  }

  threw(ex) {
    if (ex instanceof SkipTestCase) {
      this.skipped(ex);
      return;
    }

    this.setState(PassState.fail);
    this.logs.push(new LogMessageWithStack('EXCEPTION', ex));
  }

  setState(state) {
    this.state = Math.max(this.state, state);
  }

}
//# sourceMappingURL=test_case_recorder.js.map