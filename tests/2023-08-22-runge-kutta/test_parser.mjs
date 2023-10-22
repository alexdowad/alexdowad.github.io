#!/usr/bin/env node

import unit from '../unit.mjs';
import assert from 'assert/strict';

//==============================================================================

// Parser for C/Java/JavaScript-like expression syntax
function jsTokenize(str) {
	if (!str.length)
		return [];
	str = str.toLowerCase();
	const matches = Array.from(str.matchAll(/\d+(\.\d+)?|[()^/+-]|\*\*?|[\w'π]+|\s+/gy));
	const lastMatch = matches.at(-1);
	if (lastMatch.index + lastMatch[0].length !== str.length) {
		throw new Error("Parse error"); // TODO: better error handling
	}
	return Array.from(matches).map((m) => m[0]).filter((s) => /^\S+$/.test(s));
}

const knownFunctions = new Set(['sqrt', 'sin', 'cos', 'tan', 'arcsin', 'arccos', 'arctan', 'ln', 'log', 'log10', 'log2']);

function jsParse(tokens) {
	const exp = jsParseExpression(tokens);
	if (tokens.length) {
		// All tokens should have been consumed by the parser
		throw new Error("Parse error"); // TODO: better error handling
	}
	return exp;
}

function jsParseExpression(tokens) {
	if (!tokens.length)
		throw new Error("Parse error"); // TODO: better error handling

	let exp = jsParseNonBinaryExpression(tokens);

	if (!tokens.length)
		return exp;

	// Are we in the middle of a binary expression?
	const operands = [exp], operators = [];
	let tok = tokens[0];
	while (tok === '+' || tok === '-' || tok === '*' || tok === '/' || tok === '**' || tok === '^') {
		tokens.shift();
		operators.push(tok);
		operands.push(jsParseNonBinaryExpression(tokens));
		tok = tokens[0];
	}
	if (operators.length) {
		const operatorPriority = [new Set(['**', '^']), new Set(['*', '/']), new Set(['+', '-'])];
		for (const toCollapse of operatorPriority) {
			let i = 0;
			while (i < operators.length) {
				if (toCollapse.has(operators[i])) {
					operands[i] = [operators[i], operands[i], operands[i+1]];
					operands.splice(i+1, 1);
					operators.splice(i, 1);
				} else {
					i++;
				}
			}
		}
		if (operands.length !== 1)
			throw new Error("Parser could not properly build parse tree for binary operations");
		return operands[0];
	}
	return exp;
}

function jsParseNonBinaryExpression(tokens) {
	const tok = tokens.shift();
	let subExp, nextTok;

	if (tok === '(') {
		subExp = jsParseExpression(tokens);
		nextTok = tokens.shift();
		if (nextTok !== ')') {
			throw new Error("Parse error"); // TODO: better error handling
		}
		return subExp;
	}

	if (tok === ')' || tok === '+' || tok === '*' || tok === '/' || tok === '**' || tok === '^')
		throw new Error("Parse error"); // TODO: better error handling

	if (/\-?\d+(\.\d+)?/.test(tok) || tok === 't' || tok === 'x' || tok === 'y' || tok === 'z' || tok === "y'" || tok == 'e' || tok === 'π' || tok === 'pi')
		return tok;

	if (tok === '-')
		return ['-', jsParseNonBinaryExpression(tokens)];

	if (/[\w']+/.test(tok)) {
		if (!knownFunctions.has(tok))
			throw new Error(`Parse error: unknown function ${tok}`); // TODO: better error handling
		nextTok = tokens.shift();
		if (nextTok !== '(')
			throw new Error("Parse error"); // TODO: better error handling
		let param = jsParseExpression(tokens);
		nextTok = tokens.shift();
		if (nextTok !== ')')
			throw new Error("Parse error"); // TODO: better error handling
		return [tok, param];
	}

	throw new Error(`Unexpected token: ${tok}`);
}

// Convert parsed expression to a JS function object
function compileFunction(ast) {
	return new Function('t', 'y', 'z', `return ${compileNode(ast)};`);
}

function compileNode(ast) {
	if (ast === 't' || ast === 'y' || ast === 'z' || (typeof(ast) === 'string' && /\-?\d+(\.\d+)?/.test(ast)))
		return ast;
	if (ast === "y'")
		return 'z';
	// Both 't' and 'x' are traditional names for the independent variable; accept either
	if (ast === 'x')
		return 't';
	if (ast === 'e')
		return 'Math.E';
	if (ast === 'π' || ast === 'pi')
		return 'Math.PI';
	if (Array.isArray(ast)) {
		const fn = ast[0];
		if (fn === 'cos' || fn === 'sin' || fn === 'tan' || fn === 'sqrt' || fn === 'log2' || fn === 'log10')
			return `Math.${fn}(${compileNode(ast[1])})`;
		if (fn === 'arcsin' || fn === 'arccos' || fn === 'arctan')
			return `Math.a${fn.substr(3,3)}(${compileNode(ast[1])})`;
		if (fn === 'ln' || fn === 'log')
			return `Math.log(${compileNode(ast[1])})`
		if (fn === '-' && ast.length === 2) {
			if (typeof(ast[1]) === 'string')
				return `-${compileNode(ast[1])}`;
			else
				return `-(${compileNode(ast[1])})`;
		}
		if (fn === '+' || fn === '-' || fn === '*' || fn === '/' || fn === '**')
			return `(${compileNode(ast[1])}) ${fn} (${compileNode(ast[2])})`;
		if (fn === '^')
			return `(${compileNode(ast[1])}) ** (${compileNode(ast[2])})`;
	}
	throw new Error(`Unexpected AST node: ${JSON.stringify(ast)}`);
}

//==============================================================================

function tryParse(expStr, jsSrc) {
	const ast = jsParse(jsTokenize(expStr));
	assert.equal(compileNode(ast), jsSrc);
}

const suite = {};

suite.testConstants = function() {
	tryParse('1', '1');
	tryParse('2.3', '2.3');
	tryParse('π', 'Math.PI');
}

suite.testVariables = function() {
	tryParse('y', 'y');
	tryParse('t', 't');
	tryParse('z', 'z');
	tryParse("y'", 'z');
}

suite.testUnary = function() {
	tryParse('-1', '-1');
	tryParse('-y', '-y');
	tryParse('-y+1', '(-y) + (1)')
}

suite.testBinary = function() {
	tryParse('y + t', '(y) + (t)');
	tryParse('y + t + 1', '((y) + (t)) + (1)');
	tryParse('y * t', '(y) * (t)');
	tryParse('2 * π + 5', '((2) * (Math.PI)) + (5)');
}

suite.testFunctions = function() {
	tryParse('cos(y)', 'Math.cos(y)');
	tryParse('cos(t + y)', 'Math.cos((t) + (y))');
	tryParse('1 + sin(t)', '(1) + (Math.sin(t))');
	tryParse('sqrt(y)-1', '(Math.sqrt(y)) - (1)')
}

suite.testWhitespace = function() {
	tryParse('cos ( y )', 'Math.cos(y)');
	tryParse("\t\n  y+t  \t\n", '(y) + (t)');
}

suite.testParens = function() {
	tryParse('((y + (t)))', '(y) + (t)');
}

suite.testBinaryPriority = function() {
	tryParse("x+1*2", '(t) + ((1) * (2))');
	tryParse('y^2+t^2', '((y) ** (2)) + ((t) ** (2))');
}

// I entered this DE when checking my solution for exercise 2.5.16 in Gil Strang's text "Differential Equations & Linear Algebra"
suite.testDELAProblem2_5_16 = function() {
	tryParse("1-(911*y')-(1000000*y)", '((1) - ((911) * (z))) - ((1000000) * (y))');
}

process.exit(unit.runSync(suite));
