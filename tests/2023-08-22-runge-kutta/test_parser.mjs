#!/usr/bin/env node

import unit from '../unit.mjs';
import assert from 'assert/strict';

//==============================================================================

// Parser for C/Java/JavaScript-like expression syntax
function jsTokenize(str) {
	if (!str.length)
		return [];
	str = str.toLowerCase();
	const matches = Array.from(str.matchAll(/\-?\d+(\.\d+)?|[()/+-]|\*\*?|[\w'π]+|\s+/gy));
	const lastMatch = matches.at(-1);
	if (lastMatch.index + lastMatch[0].length !== str.length) {
		throw new Error("Parse error"); // TODO: better error handling
	}
	return Array.from(matches).map((m) => m[0]).filter((s) => /^\S+$/.test(s));
}

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

	let lhs = jsParseNonBinaryExpression(tokens);

	if (!tokens.length)
		return lhs;

	// Are we in the middle of a binary expression?
	let tok = tokens[0];
	while (tok === '+' || tok === '-' || tok === '*' || tok === '/' || tok === '**') {
		tokens.shift();
		lhs = [tok, lhs, jsParseNonBinaryExpression(tokens)];
		tok = tokens[0];
	}
	return lhs;
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

	if (tok === ')' || tok === '+' || tok === '*' || tok === '/' || tok === '**')
		throw new Error("Parse error"); // TODO: better error handling

	if (/\-?\d+(\.\d+)?/.test(tok) || tok === 't' || tok === 'y' || tok === 'z' || tok === "y'" || tok == 'e' || tok == 'π')
		return tok;

	if (tok === '-')
		return ['-', jsParseExpression(tokens)];

	if (/[\w']+/.test(tok)) {
		// TODO: check function name
		nextTok = tokens.shift();
		if (nextTok !== '(') {
			throw new Error("Parse error"); // TODO: better error handling
		}
		let param = jsParseExpression(tokens);
		nextTok = tokens.shift();
		if (nextTok !== ')') {
			throw new Error("Parse error"); // TODO: better error handling
		}
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
	if (ast === 'e')
		return 'Math.E';
	if (ast === 'π')
		return 'Math.PI';
	if (Array.isArray(ast)) {
		const fn = ast[0];
		if (fn === 'cos' || fn === 'sin' || fn === 'tan' || fn === 'sqrt' || fn === 'log2' || fn === 'log10')
			return `Math.${fn}(${compileNode(ast[1])})`;
		if (fn === 'arcsin' || fn === 'arccos' || fn === 'arctan')
			return `Math.a${fn.substr(3,3)}(${compileNode(ast[1])})`;
		if (fn === 'ln' || fn === 'log')
			return `Math.log(${compileNode(ast[1])})`
		if (fn === '-' && ast.length === 2)
			return `-(${compileNode(ast[1])})`;
		if (fn === '+' || fn === '-' || fn === '*' || fn === '/' || fn === '**')
			return `(${compileNode(ast[1])}) ${fn} (${compileNode(ast[2])})`;
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
}

suite.testUnary = function() {
	tryParse('-1', '-1');
	tryParse('-y', '-(y)');
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
}

suite.testWhitespace = function() {
	tryParse('cos ( y )', 'Math.cos(y)');
	tryParse("\t\n  y+t  \t\n", '(y) + (t)');
}

suite.testParens = function() {
	tryParse('((y + (t)))', '(y) + (t)');
}

process.exit(unit.runSync(suite));
