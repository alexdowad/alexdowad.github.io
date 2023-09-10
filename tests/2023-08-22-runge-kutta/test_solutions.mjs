#!/usr/bin/env node

import unit from '../unit.mjs';
import assert from 'assert/strict';

//==============================================================================

class Solution {
	constructor(t_start, t_end, Δt, nVars) {
		this.t_start = t_start;
		this.t_end = t_end;
		this.Δt = Δt;
		this.nVars = nVars;
		this.nPoints = Math.floor(((t_end - t_start) / Δt) + 1);
		// Packed array of values for all variables at each time step:
		// (Values for each variable occupy a contiguous range of indices)
		this.array = new Float64Array(nVars * this.nPoints);
		// Packed array of estimated derivatives of all variables at each time step:
		this.diff = undefined;
	}

	// Find range of indices with values for a particular variable
	startIndex(varIndex) {
		return this.nPoints * varIndex;
	}
	endIndex(varIndex) {
		return this.startIndex(varIndex+1);
	}

	// Find index of value for a particular variable and time step
	timeIndex(varIndex, t) {
		return this.startIndex(varIndex) + Math.floor((t - this.t_start) / this.Δt);
	}
	timeValue(varIndex, t) {
		return this.array[this.timeIndex(varIndex, t)];
	}

	values(varIndex) {
		return this.array.subarray(this.startIndex(varIndex), this.endIndex(varIndex));
	}
}

// Trace out evolution of our system using classic Runge-Kutta (AKA "RK4")
// Store results in a packed array of floats
function rk4trace(y, t, Δt, fn, ary, i, Δi, limit) {
	while (i !== limit) {
		const half_Δt = Δt / 2.0;
		const next_t = t + Δt;
		const half_t = t + half_Δt;

		const k_1 = fn(t, y); // Slope at starting point
		const k_2 = fn(half_t, y + (half_Δt * k_1)); // Estimated slope at mid-point
		const k_3 = fn(half_t, y + (half_Δt * k_2)); // Another estimate of slope at mid-point
		const k_4 = fn(next_t, y + (Δt * k_3)); // Estimated slope at endpoint

		const slope = (k_1 + 2*k_2 + 2*k_3 + k_4) / 6.0; // Weighted average of those four slopes

		y += Δt * slope;
		ary[i] = y;
		t += Δt;
		i += Δi;
	}
}

// Apply RK4 to find phase lines for a system with one dependent variable
function rk4solve(y_0, t_0, t_start, t_end, Δt, fn) {
	let t = t_0, y = y_0, solution = new Solution(t_start, t_end, Δt, 1);
	let i = solution.timeIndex(0, t_0);
	solution.array[i] = y_0;

	// Trace out phase line from starting point
	rk4trace(y_0, t_0, Δt, fn, solution.array, i+1, 1, solution.endIndex(0));

	// Trace out phase line in the opposite direction from the starting point
	rk4trace(y_0, t_0, -Δt, fn, solution.array, i-1, -1, solution.startIndex(0)-1);

	return solution;
}

function rk4trace_2(y, z, t, Δt, fn_y, fn_z, ary, i, Δi, offset, limit) {
	while (i !== limit) {
		const half_Δt = Δt / 2.0;
		const next_t = t + Δt;
		const half_t = t + half_Δt;

		const k_1y = fn_y(t, y, z); // Slope at starting point
		const k_1z = fn_z(t, y, z);
		const k_2y = fn_y(half_t, y + (half_Δt * k_1y), z + (half_Δt * k_1z)); // Estimated slope at mid-point
		const k_2z = fn_z(half_t, y + (half_Δt * k_1y), z + (half_Δt * k_1z));
		const k_3y = fn_y(half_t, y + (half_Δt * k_2y), z + (half_Δt * k_2z)); // Another estimate of slope at mid-point
		const k_3z = fn_z(half_t, y + (half_Δt * k_2y), z + (half_Δt * k_2z));
		const k_4y = fn_y(next_t, y + (Δt * k_3y), z + (Δt * k_3z)); // Estimated slope at endpoint
		const k_4z = fn_z(next_t, y + (Δt * k_3y), z + (Δt * k_3z));

		const slope_y = (k_1y + 2*k_2y + 2*k_3y + k_4y) / 6.0; // Weighted average of those four slopes
		const slope_z = (k_1z + 2*k_2z + 2*k_3z + k_4z) / 6.0;

		y += Δt * slope_y;
		z += Δt * slope_z;
		ary[i] = y;
		ary[i+offset] = z;
		t += Δt;
		i += Δi;
	}
}

// Apply RK4 to find phase lines for a system with two dependent variables
function rk4solve_2(y_0, z_0, t_0, t_start, t_end, Δt, fn_y, fn_z) {
	let t = t_0, y = y_0, z = z_0, solution = new Solution(t_start, t_end, Δt, 2);
	let i = solution.timeIndex(0, t_0), offset = solution.startIndex(1);
	solution.array[i] = y_0;
	solution.array[i+offset] = z_0;

	// Trace out phase line from starting point
	rk4trace_2(y_0, z_0, t_0, Δt, fn_y, fn_z, solution.array, i+1, 1, offset, solution.endIndex(0));

	// Trace out phase line in the opposite direction from the starting point
	rk4trace_2(y_0, z_0, t_0, -Δt, fn_y, fn_z, solution.array, i-1, -1, offset, solution.startIndex(0)-1);

	return solution;
}

function order1_solutions(y_0, t_0, t_start, t_end, Δt, fn) {
	const result = [];
	if (!Array.isArray(y_0))
		y_0 = [y_0];
	for (const y of y_0) {
		const solution = rk4solve(y, t_0, t_start, t_end, Δt, fn);
		solution.startConditions = `y(${t_0}) = ${y}`;
		solution.startY = y;
		result.push(solution);
	}
	return result;
}

function order2_solutions(y_0, dy_0, t_0, t_start, t_end, Δt, fn) {
	const result = [];
	if (!Array.isArray(y_0))
		y_0 = [y_0];
	if (!Array.isArray(dy_0))
		dy_0 = [dy_0];
	for (const y of y_0) {
		for (const dy of dy_0) {
			const solution = rk4solve_2(y, dy, t_0, t_start, t_end, Δt, function(t, y, dy) { return dy; }, fn);
			solution.startConditions = `y(${t_0}) = ${y}, y'(${t_0}) = ${dy}`;
			solution.startY = y;
			solution.startZ = dy;
			result.push(solution);
		}
	}
	return result;
}

function eqs2_order1_solutions(y_0, z_0, t_0, t_start, t_end, Δt, fn_y, fn_z) {
	const result = [];
	if (!Array.isArray(y_0))
		y_0 = [y_0];
	if (!Array.isArray(z_0))
		z_0 = [z_0];
	for (const y of y_0) {
		for (const z of z_0) {
			const solution = rk4solve_2(y, z, t_0, t_start, t_end, Δt, fn_y, fn_z);
			solution.startConditions = `y(${t_0}) = ${y}, z(${t_0}) = ${z}`;
			solution.startY = y;
			solution.startZ = z;
			result.push(solution);
		}
	}
	return result;
}

//==============================================================================

// This test suite works by numerically solving DEs with known analytic solutions,
// then comparing the numeric/analytic solutions to make sure they are "close",
// for some (arbitrary) notion of "close"

// I do not understand the intricacies of Runge-Kutta enough to estimate what
// the expected error margin of a 'correct' implementation of RK4 should be
// So the values of parameters like time step and expected tolerances below are
// arbitrary, and in some cases determined through trial and error

const suite = {};

function assertTolerance(v1, v2, tolerance) {
	assert(Math.abs(v1 - v2) <= tolerance, `Expected ${v1} to be close to ${v2}`)
}

suite.test_cosT_order1 = function() {
	// y' = cos(t) has general solution y(t) = sin(t) + y(0)
	const s = order1_solutions([0, 10], 0, 0, 10, 0.01, function(t, y) { return Math.cos(t); });
	// Testing first with y(0) = 0
	assertTolerance(0, s[0].timeValue(0, 0), 0.01);
	assertTolerance(1/Math.sqrt(2), s[0].timeValue(0, Math.PI/4), 0.01);
	assertTolerance(1, s[0].timeValue(0, Math.PI/2), 0.01);
	assertTolerance(0, s[0].timeValue(0, Math.PI), 0.01);
	// Now testing with y(0) = 10
	assertTolerance(10, s[1].timeValue(0, 0), 0.01);
	assertTolerance(10+(1/Math.sqrt(2)), s[1].timeValue(0, Math.PI/4), 0.01);
	assertTolerance(11, s[1].timeValue(0, Math.PI/2), 0.01);
	assertTolerance(10, s[1].timeValue(0, Math.PI), 0.01);
}

suite.test_cosY_order1 = function() {
	// If y' = cos(y), y = arcsin(e^2t - 1 / e^2t + 1) for y(0) = 0
	// (Regardless of y(0), y' = cos(y) always decays to the closest zero of cos)
	const s = order1_solutions([0, 10], 0, 0, 10, 0.01, function(t, y) { return Math.cos(y); });
	// Testing first with y(0) = 0
	assertTolerance(0, s[0].timeValue(0, 0), 0.01);
	assertTolerance(Math.asin((Math.E ** 2 - 1) / (Math.E ** 2 + 1)), s[0].timeValue(0, 1), 0.01);
	assertTolerance(Math.PI/2, s[0].timeValue(0, 10), 0.01);
	// Now testing with y(0) = 10
	assertTolerance(10, s[1].timeValue(0, 0), 0.01);
	assertTolerance(Math.PI*2.5, s[1].timeValue(0, 10), 0.01);
}

suite.test_Y_order1 = function() {
	// If y' = y, y = e^y
	const s = order1_solutions([1, 2], 0, 0, 3, 0.01, function(t, y) { return y; });
	// Test with y(0) = 1; solution is e^y
	assertTolerance(1, s[0].timeValue(0, 0), 0.01);
	assertTolerance(Math.E, s[0].timeValue(0, 1), 0.01);
	assertTolerance(Math.E ** 2, s[0].timeValue(0, 2), 0.01);
	// Test with y(0) = 2; solution is 2e^y
	assertTolerance(2, s[1].timeValue(0, 0), 0.01);
	assertTolerance(2 * Math.E, s[1].timeValue(0, 1), 0.01);
	assertTolerance(2 * (Math.E ** 2), s[1].timeValue(0, 2), 0.01);
}

suite.test_T_order1 = function() {
	// If y' = t, y = (t^2)/2 + y(0)
	const s = order1_solutions([0,5], 0, 0, 10, 0.01, function(t, y) { return t; });
	// Test with y(0) = 0
	assertTolerance(0.5, s[0].timeValue(0, 1), 0.01);
	assertTolerance((5**2)/2, s[0].timeValue(0, 5), 0.01);
	// Test with y(0) = 5
	assertTolerance(5.5, s[1].timeValue(0, 1), 0.01);
	assertTolerance(5 + (5**2)/2, s[1].timeValue(0, 5), 0.01);
}

process.exit(unit.runSync(suite));
