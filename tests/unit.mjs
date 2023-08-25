/* Minimal unit test runner for Node.JS
 * Inspired by LuaUnit
 *
 * For this runner, a unit test suite is just a JS object with methods starting in 'test'.
 * Each method is a test case. In non-strict mode, you can use the global object as a test
 * suite. To run one or more test suites, pass them to `run` or `runSync`. It will return 1
 * for failure or 0 for success.
 *
 * We don't define assertion methods, since Node.JS has the 'assert' library built in.
 * Anything which throws an `AssertionError` fails a test case. To skip a test case,
 * call `skip`.
 *
 * Example (in CommonJS format):
 *
 *    const assert = require('assert/strict');
 *    const unit   = require('./unit.mjs');
 *
 *    function testFoo() { // using global object as test suite
 *      assert.equal(1, 1);
 *    }
 *
 *    function testBar() {
 *      unit.skip('Reason');
 *    }
 *
 *    process.exit(unit.runSync(this));
 *
 * And for test suites which must use asynchronous code:
 *
 *   async function testFoo() { }
 *
 *   unit.run(this).then(resultCode => process.exit(resultCode));
 *   // or: process.exit(await unit.run(this))
 *
 * In strict mode:
 *
 *   const suite = {};
 *   suite.testFoo = function() {}
 *
 *   process.exit(unit.runSync(suite));
 *
 * Like LuaUnit, you can select specific test cases to run via a regex. Like this:
 *
 *   ./my-test-suite.js -p <regex>
 *
 * And output format can be selected with:
 *
 *   ./my-test-suite.js -o <tap|default>
 */
'use strict';

/* Process CLI arguments */
function getOptions() {
	const options = {};
	for (var i = 0; i < process.argv.length; i++) {
		const arg = process.argv[i];
		if (arg == '-p' || arg == '--pattern') {
			options.pattern = process.argv[++i];
		} else if (arg == '-o' || arg == '--output') {
			options.format = process.argv[++i];
		}
	}
	return options;
}

/* Convert Node.JS default stack trace format to one more suitable for display */
function prepareStackTrace(trace) {
	const lines = trace.split("\n");

	/* Remove the error message, since we will show that separately */
	while (!lines[0].match(/^\s*at/))
		lines.shift();

	/* Remove lines from the stack trace for top level code which leads into unit.mjs
	 * (either by calling `run` or `runSync`)
	 * We just want to see what failed in the test case itself */
	if (lines.some(line => line.match(/run.*unit\.mjs/))) {
		while (lines.length && !lines[lines.length-1].match(/run.*unit\.mjs/))
			lines.pop();
		lines.pop();
	}
	return lines.join("\n");
}

/* Default output format is modeled on LuaUnit */
class DefaultFormat {
	constructor() {
		this.failed  = [];
		this.errored = [];
		this.skipped = [];
	}

	end(passed, failed, skipped, errored, elapsed) {
		process.stdout.write("\n\n");

		if (failed) {
			process.stdout.write('Failed tests:\n-------------\n');
			var count = 0;
			for (const { testName, message, stack } of this.failed) {
				process.stdout.write(`${++count}) ${testName}\n`);
				console.log(message.trimRight());
				console.log(stack);
				process.stdout.write("\n");
			}
		}
		if (errored) {
			process.stdout.write('Errored tests:\n--------------\n');
			var count = 0;
			for (const { testName, message, stack } of this.errored) {
				process.stdout.write(`${++count}) ${testName}\n`);
				console.log(message.trimRight());
				console.log(stack);
				process.stdout.write("\n");
			}
		}
		if (skipped) {
			process.stdout.write('Skipped tests:\n--------------\n');
			var count = 0;
			for (const { testName, message } of this.skipped) {
				process.stdout.write(`${++count}) ${message.trimRight()}\n`);
			}
			process.stdout.write("\n");
		}

		process.stdout.write(`Ran ${passed + failed + skipped + errored} tests in ${elapsed / 1000}s`)
		if (passed)
			process.stdout.write(`, ${passed} success${passed > 1 ? 'es' : ''}`);
		if (failed)
			process.stdout.write(`, ${failed} failure${failed > 1 ? 's' : ''}`);
		if (errored)
			process.stdout.write(`, ${errored} error${errored > 1 ? 's' : ''}`);
		if (skipped)
			process.stdout.write(`, ${skipped} skipped`);
		process.stdout.write("\n");
	}

	testPassed(testName) {
		process.stdout.write('.');
	}

	testFailed(testName, assertion) {
		process.stdout.write('F');
		this.failed.push({ testName: testName, message: assertion.message, stack: prepareStackTrace(assertion.stack) });
	}

	testSkipped(testName, skip) {
		process.stdout.write('S');
		this.skipped.push({ testName: testName, message: skip.message });
	}

	testErrored(testName, err) {
		process.stdout.write('E');
		this.errored.push({ testName: testName, message: err.message, stack: prepareStackTrace(err.stack) });
	}
}

/* Test Anything Protocol format
 * Ref: http://testanything.org/ */
class TapFormat {
	constructor() {
		this.count = 0;
	}

	end(passed, failed, skipped, errored) {}

	testPassed(testName) {
		process.stdout.write(`ok\t${++this.count}\t${testName}\n`);
	}

	testFailed(testName, assertion) {
		process.stdout.write(`not ok\t${++this.count}\t${testName}\n`);
		for (const line of assertion.message.trimRight().split("\n"))
			process.stdout.write(`# ${line.trimRight()}\n`);
		for (const line of prepareStackTrace(assertion.stack).split("\n"))
			process.stdout.write(`# ${line}\n`);
	}

	testSkipped(testName, skip) {
		process.stdout.write(`ok\t${++this.count}\t${testName} # SKIP ${skip.message.trimRight()}\n`);
	}

	testErrored(testName, err) {
		process.stdout.write(`not ok\t${++this.count}\t${testName}\n`);
		for (const line of err.message.trimRight().split("\n"))
			process.stdout.write(`# ${line.trimRight()}\n`);
		for (const line of prepareStackTrace(err.stack).split("\n"))
			process.stdout.write(`# ${line}\n`);
	}
}

function getFormatter(format) {
	format = format.toLowerCase();
	if (format == 'default')
		return new DefaultFormat();
	else if (format == 'tap')
		return new TapFormat();
	else
		throw new Error(`Unknown output format: ${format}`);
}

/* All properties on `suite` with names starting with 'test' are test cases.
 * Filter out any other properties.
 * If given a regexp, use it to select which test cases to run. */
function findTestCases(suite, pattern) {
	const testCases = {}, regex = pattern && new RegExp(pattern);
	for (var property in suite) {
		if (property.match(/^test/i) && (!regex || property.match(regex))) {
			testCases[property] = suite[property];
		}
	}
	return testCases;
}

class Skip extends Error {
	constructor(message) {
		super(message);
		this.name = 'Skip';
	}
}

function skip(message) {
	throw new Skip(message);
}

function runSync(...suites) {
	const opts   = getOptions();
	const format = getFormatter(opts.format || 'default');
	const time   = new Date;

	var passed = 0, failed = 0, skipped = 0, errored = 0;
	for (var suite of suites) {
		var tests = findTestCases(suite, opts.pattern);

		const setup    = suite.setup    || function() {}
		const teardown = suite.teardown || function() {}

		for (var testName in tests) {
			const testCase = tests[testName];
			try {
				setup();
				testCase();
				format.testPassed(testName);
				passed += 1;
			} catch (e) {
				if (e.name == 'AssertionError') {
					format.testFailed(testName, e);
					failed += 1;
				} else if (e.name == 'Skip') {
					format.testSkipped(testName, e);
					skipped += 1;
				} else {
					format.testErrored(testName, e);
					errored += 1;
				}
			}
			teardown();
		}
	}

	const elapsed = (new Date()) - time; /* in milliseconds */
	format.end(passed, failed, skipped, errored, elapsed);

	/* Return exit code which caller can pass to `process.exit` */
	return (failed > 0 || errored > 0) ? 1 : 0;
}

/* Same as `runSync`, but asynchronous. `await` is used to run each test case,
 * so test cases will still run sequentially and not overlap with each other. */
async function run(...suites) {
	const opts   = getOptions();
	const format = getFormatter(opts.format || 'default');
	const time   = new Date;

	var passed = 0, failed = 0, skipped = 0, errored = 0;
	for (var suite of suites) {
		var tests = findTestCases(suite, opts.pattern);

		const setup    = suite.setup    || function() {}
		const teardown = suite.teardown || function() {}

		for (var testName in tests) {
			const testCase = tests[testName];
			try {
				await setup();
				await testCase();
				format.testPassed(testName);
				passed += 1;
			} catch (e) {
				if (e.name == 'AssertionError') {
					format.testFailed(testName, e);
					failed += 1;
				} else if (e.name == 'Skip') {
					format.testSkipped(testName, e);
					skipped += 1;
				} else {
					format.testErrored(testName, e);
					errored += 1;
				}
			}
			await teardown();
		}
	}

	const elapsed = (new Date) - time; /* in milliseconds */
	format.end(passed, failed, skipped, errored, elapsed);

	/* Return exit code which caller can pass to `process.exit` */
	return (failed > 0 || errored > 0) ? 1 : 0;
}

export default {
	skip: skip,
	runSync: runSync,
	run: run
};
