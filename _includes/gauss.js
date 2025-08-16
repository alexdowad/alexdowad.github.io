function createMatrix(rows, cols, data=undefined) {
	// Validate data array shape if provided
	if (data !== undefined) {
		if (!Array.isArray(data)) {
			throw new Error("Data must be an array");
		}
		if (data.length !== rows) {
			throw new Error(`Data array has ${data.length} rows, expected ${rows}`);
		}
		for (let i = 0; i < rows; i++) {
			if (!Array.isArray(data[i])) {
				throw new Error(`Row ${i} is not an array`);
			}
			if (data[i].length !== cols) {
				throw new Error(`Row ${i} has ${data[i].length} columns, expected ${cols}`);
			}
		}
	}

	const matrix = {
		rows: rows,
		cols: cols,
		data: data || Array(rows).fill().map(() => Array(cols).fill(0))
	};

	matrix.get = function(i, j) {
		return this.data[i][j];
	};
	matrix.set = function(i, j, value) {
		this.data[i][j] = value;
	};
	matrix.copy = function() {
		return createMatrix(this.rows, this.cols, this.data.map(row => [...row]));
	};

	return matrix;
}

function createVector(size, data=undefined) {
	const vector = {
		size: size,
		data: data || Array(size).fill(0)
	};

	vector.get = function(i) {
		return this.data[i];
	};
	vector.set = function(i, value) {
		this.data[i] = value;
	};
	vector.copy = function() {
		return createVector(this.size, [...this.data]);
	};

	return vector;
}


function randomNonSingularMatrix(n, minVal=-9, maxVal=9) {
	// Start with identity matrix to guarantee non-singularity
	const matrix = createMatrix(n, n);
	for (let i = 0; i < n; i++) {
		matrix.set(i, i, 1);
	}

	// Helper function to generate random integer in range
	function randomInt(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	// Apply random elementary row operations to make it look random
	// while preserving non-singularity
	for (let iter = 0; iter < n * 3; iter++) {
		const opType = Math.floor(Math.random() * 2); // 0 or 1

		if (opType === 0) {
			// Add a multiple of one row to another
			let i = randomInt(0, n - 1);
			let j = randomInt(0, n - 1);
			while (i === j) {
				j = randomInt(0, n - 1);
			}

			const factor = randomInt(minVal, maxVal);
			if (factor !== 0) {
				// Check if this will cause values in row to go outside [minVal, maxVal]
				let ok = true;
				for (let k = 0; k < n; k++) {
					let value = matrix.get(i, k) + factor * matrix.get(j, k);
					if (value < minVal || value > maxVal) {
						ok = false;
						break;
					}
				}
				if (ok) {
					for (let k = 0; k < n; k++) {
						matrix.set(i, k, matrix.get(i, k) + factor * matrix.get(j, k));
					}
				}
			}
		} else {
			// Multiply a row by a non-zero constant
			const i = randomInt(0, n - 1);
			let factor = randomInt(minVal, maxVal);
			while (factor === 0) {
				factor = randomInt(minVal, maxVal);
			}
			// Check if this will cause values in row to go outside [minVal, maxVal]
			let ok = true;
			for (let k = 0; k < n; k++) {
				let value = matrix.get(i, k) * factor;
				if (value < minVal || value > maxVal) {
					ok = false;
					break;
				}
			}
			if (ok) {
				for (let k = 0; k < n; k++) {
					matrix.set(i, k, matrix.get(i, k) * factor);
				}
			}
		}
	}

	return matrix;
}

function randomNonSingularMatrixMod(n, modulus, minVal=-9, maxVal=9) {
	if (maxVal >= modulus)
		maxVal = modulus - 1;
	if (minVal <= -modulus)
		minVal = -modulus + 1;
	return randomNonSingularMatrix(n, minVal, maxVal);
}

function randomVector(n, minVal = -12, maxVal = 12) {
	const vector = createVector(n);
	for (let i = 0; i < n; i++) {
		vector.set(i, Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal);
	}
	return vector;
}

function randomVectorMod(n, modulus, minVal = -12, maxVal = 12) {
	if (maxVal >= modulus)
		maxVal = modulus - 1;
	if (minVal <= -modulus)
		minVal = -modulus + 1;
	return randomVector(n, minVal, maxVal);
}

function modInverse(a, m) {
	// Extended Euclidean Algorithm to find modular inverse
	function extgcd(a, b) {
		if (a === 0) return [b, 0, 1];
		const [gcd, x1, y1] = extgcd(b % a, a);
		const x = y1 - Math.floor(b / a) * x1;
		const y = x1;
		return [gcd, x, y];
	}

	const [gcd, x, y] = extgcd(((a % m) + m) % m, m);
	if (gcd !== 1) {
		throw new Error(`Modular inverse of ${a} mod ${m} does not exist`);
	}
	return ((x % m) + m) % m;
}

function gaussianSteps(A, b) {
	if (A.rows !== A.cols) {
		throw new Error("A must be square");
	}
	const n = A.rows;
	const augmented = createMatrix(n, n + 1);
	const steps = [];

	// Create augmented matrix [A|b]
	for (let i = 0; i < n; i++) {
		for (let j = 0; j < n; j++) {
			augmented.set(i, j, A.get(i, j));
		}
		augmented.set(i, n, b.get(i));
	}

	// Add initial state
	steps.push({
		type: "start",
		description: "Initial augmented matrix [A|b]",
		matrix: augmented.copy()
	});

	// Forward elimination
	for (let k = 0; k < n; k++) {
		// Find pivot
		let pivotRow = k;
		for (let i = k + 1; i < n; i++) {
			if (Math.abs(augmented.get(i, k)) > Math.abs(augmented.get(pivotRow, k))) {
				pivotRow = i;
			}
		}

		// Check if the column is already empty aside from the pivot
		let alreadyEmpty = true;
		for (let i = k; i < n; i++) {
			if (i !== pivotRow && Math.abs(augmented.get(i, k)) > 1e-10) {
				alreadyEmpty = false;
				break;
			}
		}
		if (alreadyEmpty) {
			if (pivotRow !== k) {
				steps.push({
					type: "choose_pivot",
					description: `Choose ${augmented.get(pivotRow, k).toFixed(2)} as the pivot element`,
					pivotRow: pivotRow,
					pivotCol: k,
					matrix: augmented.copy()
				});
				for (let j = 0; j < n + 1; j++) {
					const temp = augmented.get(k, j);
					augmented.set(k, j, augmented.get(pivotRow, j));
					augmented.set(pivotRow, j, temp);
				}
				steps.push({
					type: "row_swap",
					description: `Swap row ${k+1} with row ${pivotRow+1}`,
					swappedRows: [k, pivotRow],
					matrix: augmented.copy()
				});
			}
			continue; // Go to the next column
		}

		steps.push({
			type: "choose_pivot",
			description: `Choose ${augmented.get(pivotRow, k).toFixed(2)} as the pivot element to clear column ${k+1}`,
			pivotRow: pivotRow,
			pivotCol: k,
			matrix: augmented.copy()
		});

		// Swap rows if needed
		if (pivotRow !== k) {
			for (let j = 0; j < n + 1; j++) {
				const temp = augmented.get(k, j);
				augmented.set(k, j, augmented.get(pivotRow, j));
				augmented.set(pivotRow, j, temp);
			}
			steps.push({
				type: "row_swap",
				description: `Swap row ${k+1} with row ${pivotRow+1}`,
				swappedRows: [k, pivotRow],
				matrix: augmented.copy()
			});
		}

		// Check for zero pivot
		if (Math.abs(augmented.get(k, k)) < 1e-10) {
			throw new Error("Matrix is singular or nearly singular");
		}

		// Eliminate column
		for (let i = k + 1; i < n; i++) {
			const factor = augmented.get(i, k) / augmented.get(k, k);
			if (Math.abs(factor) > 1e-10) {
				for (let j = k; j < n + 1; j++) {
					augmented.set(i, j, augmented.get(i, j) - factor * augmented.get(k, j));
				}
				steps.push({
					type: "elimination",
					description: `Row ${i+1} = Row ${i+1} - (${factor.toFixed(2)} ⨯ Row ${k+1})`,
					eliminatedRow: i,
					pivotRow: k,
					pivotCol: k,
					factor: factor,
					matrix: augmented.copy()
				});
			}
		}
	}

	// Backward elimination (zero out above diagonal)
	for (let k = n - 1; k >= 0; k--) {
		// Scale the pivot row to make diagonal element 1
		const pivot = augmented.get(k, k);
		if (Math.abs(pivot) > 1e-10) {
			for (let j = k; j < n + 1; j++) {
				augmented.set(k, j, augmented.get(k, j) / pivot);
			}
			if (Math.abs(pivot - 1) > 1e-10) { // Only add step if scaling was needed
				steps.push({
					type: "elimination",
					description: `Row ${k+1} = Row ${k+1} / ${pivot.toFixed(2)}`,
					eliminatedRow: k,
					pivotRow: k,
					pivotCol: k,
					factor: 1 / pivot,
					matrix: augmented.copy()
				});
			}
		}

		// Eliminate above the diagonal
		for (let i = k - 1; i >= 0; i--) {
			const factor = augmented.get(i, k);
			if (Math.abs(factor) > 1e-10) {
				for (let j = k; j < n + 1; j++) {
					augmented.set(i, j, augmented.get(i, j) - factor * augmented.get(k, j));
				}
				steps.push({
					type: "elimination",
					description: `Row ${i+1} = Row ${i+1} - (${factor.toFixed(2)} ⨯ Row ${k+1})`,
					eliminatedRow: i,
					pivotRow: k,
					pivotCol: k,
					factor: factor,
					matrix: augmented.copy()
				});
			}
		}
	}

	// Extract solution from the augmented column
	const solution = [];
	for (let i = 0; i < n; i++) {
		solution.push(augmented.get(i, n));
	}

	steps.push({
		type: "final_solution",
		description: `The final solution is: [ ${solution.map((x) => x.toFixed(2)).join(' ')} ]`,
		matrix: augmented.copy(),
		solution: solution
	});

	return steps;
}

function gaussianStepsMod(A, b, mod) {
	if (A.rows !== A.cols) {
		throw new Error("A must be square");
	}
	const n = A.rows;
	const augmented = createMatrix(n, n + 1);
	const steps = [];

	// Create augmented matrix [A|b] with all values mod m
	for (let i = 0; i < n; i++) {
		for (let j = 0; j < n; j++) {
			augmented.set(i, j, ((A.get(i, j) % mod) + mod) % mod);
		}
		augmented.set(i, n, ((b.get(i) % mod) + mod) % mod);
	}

	// Add initial state
	steps.push({
		type: "start",
		description: `Initial augmented matrix [A|b] (mod ${mod})`,
		matrix: augmented.copy()
	});

	// Forward elimination
	for (let k = 0; k < n; k++) {
		// Find pivot (first non-zero element)
		let pivotRow = -1;
		for (let i = k; i < n; i++) {
			if (augmented.get(i, k) !== 0) {
				pivotRow = i;
				break;
			}
		}

		if (pivotRow === -1) {
			throw new Error("Matrix is singular in the finite field");
		}

		// Check if the column is already empty aside from the pivot
		let alreadyEmpty = true;
		for (let i = k; i < n; i++) {
			if (i !== pivotRow && augmented.get(i, k) !== 0) {
				alreadyEmpty = false;
				break;
			}
		}

		if (alreadyEmpty) {
			if (pivotRow !== k) {
				steps.push({
					type: "choose_pivot",
					description: `Choose ${augmented.get(pivotRow, k)} as the pivot element`,
					pivotRow: pivotRow,
					pivotCol: k,
					matrix: augmented.copy()
				});
			}
		} else {
			steps.push({
				type: "choose_pivot",
				description: `Choose ${augmented.get(pivotRow, k)} as the pivot element to clear column ${k+1}`,
				pivotRow: pivotRow,
				pivotCol: k,
				matrix: augmented.copy()
			});
		}

		// Swap rows if needed
		if (pivotRow !== k) {
			for (let j = 0; j < n + 1; j++) {
				const temp = augmented.get(k, j);
				augmented.set(k, j, augmented.get(pivotRow, j));
				augmented.set(pivotRow, j, temp);
			}
			steps.push({
				type: "row_swap",
				description: `Swap row ${k+1} with row ${pivotRow+1}`,
				swappedRows: [k, pivotRow],
				matrix: augmented.copy()
			});
		}

		// Scale pivot row to make diagonal element 1
		const pivot = augmented.get(k, k);
		if (pivot !== 1) {
			const pivotInv = modInverse(pivot, mod);
			for (let j = k; j < n + 1; j++) {
				const val = (augmented.get(k, j) * pivotInv) % mod;
				augmented.set(k, j, val);
			}
			steps.push({
				type: "elimination",
				description: `Row ${k+1} = Row ${k+1} ⨯ ${pivotInv} (mod ${mod})`,
				eliminatedRow: k,
				pivotRow: k,
				pivotCol: k,
				factor: pivotInv,
				matrix: augmented.copy()
			});
		}

		// Eliminate column below diagonal
		for (let i = k + 1; i < n; i++) {
			const factor = augmented.get(i, k);
			if (factor !== 0) {
				for (let j = k; j < n + 1; j++) {
					const val = ((augmented.get(i, j) - factor * augmented.get(k, j)) % mod + mod) % mod;
					augmented.set(i, j, val);
				}
				steps.push({
					type: "elimination",
					description: `Row ${i+1} = Row ${i+1} - (${factor} ⨯ Row ${k+1}) (mod ${mod})`,
					eliminatedRow: i,
					pivotRow: k,
					pivotCol: k,
					factor: factor,
					matrix: augmented.copy()
				});
			}
		}
	}

	// Backward elimination (zero out above diagonal)
	for (let k = n - 1; k >= 0; k--) {
		// Eliminate above the diagonal
		for (let i = k - 1; i >= 0; i--) {
			const factor = augmented.get(i, k);
			if (factor !== 0) {
				for (let j = k; j < n + 1; j++) {
					const val = ((augmented.get(i, j) - factor * augmented.get(k, j)) % mod + mod) % mod;
					augmented.set(i, j, val);
				}
				steps.push({
					type: "elimination",
					description: `Row ${i+1} = Row ${i+1} - (${factor} ⨯ Row ${k+1}) (mod ${mod})`,
					eliminatedRow: i,
					pivotRow: k,
					pivotCol: k,
					factor: factor,
					matrix: augmented.copy()
				});
			}
		}
	}

	// Extract solution from the augmented column
	const solution = [];
	for (let i = 0; i < n; i++) {
		solution.push(augmented.get(i, n));
	}

	steps.push({
		type: "final_solution",
		description: `The final solution is: [ ${solution.join(' ')} ] (mod ${mod})`,
		matrix: augmented.copy(),
		solution: solution
	});

	return steps;
}

function renderAugmentedMatrix(matrix, container, precision=2) {
	if (matrix.cols !== matrix.rows+1) {
		throw new Error("Augmented matrix should have 1 more columns than rows");
	}
	const rows = matrix.rows;
	const cols = matrix.cols;
	const augmentedCol = cols - 1;

	let tex = `\\left[ \\begin{array}{${'c'.repeat(cols-1)}|c} `;
	for (let i = 0; i < rows; i++) {
		tex += matrix.data[i].join(' & ');
		if (i < rows-1) {
			tex += ' \\\\ ';
		}
	}
	tex += ` \\end{array} \\right]`;
	katex.render(tex, container, { displayMode: true, output: 'html' });
}

function clearMatrixHighlights(div) {
	const existingHighlights = div.querySelectorAll('.matrix-highlight');
	existingHighlights.forEach(el => {
		el.classList.remove('matrix-highlight');
		el.style.boxShadow = '';
		el.style.borderRadius = '';
		el.style.backgroundColor = '';
		el.style.padding = '';
	});
}

function highlightMatrixElement(div, row, col) {
	// Clear any existing highlights
	clearMatrixHighlights(div);

	// Find the mtable element (the matrix container)
	const mtable = div.querySelector('.mtable');
	if (!mtable) {
		console.error('No matrix table found');
		return;
	}

	// Get all column elements (col-align-c spans)
	const columns = mtable.querySelectorAll('.col-align-c');
	if (columns.length === 0) {
		console.error('No matrix columns found');
		return;
	}

	// Find the target column
	// KaTeX uses array separators between columns, so we need to account for this
	// The structure has arraycolsep elements between actual columns
	let actualColumnIndex = 0;
	let targetColumn = null;

	for (let i = 0; i < columns.length; i++) {
		if (actualColumnIndex === col) {
			targetColumn = columns[i];
			break;
		}
		actualColumnIndex++;
	}

	if (!targetColumn) {
		console.error(`Column ${col} not found`);
		return;
	}

	// Within the column, find all the cell elements that contain numbers
	// Look for .mord elements within the vlist structure
	const vlist = targetColumn.querySelector('.vlist-r .vlist');
	if (!vlist) {
		console.error('No vlist found in column');
		return;
	}

	const cellContainers = vlist.children;
	if (row >= cellContainers.length) {
		console.error(`Row ${row} not found in column ${col}`);
		return;
	}

	// Find the .mord element within the target row
	const targetRowContainer = cellContainers[row];
	const targetCell = targetRowContainer.querySelector('.mord');

	if (!targetCell) {
		console.error(`Cell at row ${row}, col ${col} not found`);
		return;
	}

	// Apply highlight styling
	targetCell.classList.add('matrix-highlight');
	targetCell.style.boxShadow = '0 0 10px 2px rgba(255, 215, 0, 0.8)';
	targetCell.style.borderRadius = '3px';
	targetCell.style.backgroundColor = 'rgba(255, 255, 0, 0.1)';
	targetCell.style.transition = 'all 0.3s ease';
	targetCell.style.padding = '1px 1px';
}

function updateMatrixValues(div, matrix, precision=2) {
	// Find the mtable element (the matrix container)
	const mtable = div.querySelector('.mtable');
	if (!mtable) {
		throw new Error("Provided div does not have a matrix rendered by KaTeX");
	}

	// Get all column elements (col-align-c spans)
	const columns = mtable.querySelectorAll('.col-align-c');
	if (columns.length === 0) {
		throw new Error("No matrix columns found");
	}

	// Expected dimensions
	const expectedCols = matrix.cols;
	const expectedRows = matrix.rows;

	if (columns.length !== expectedCols) {
		throw new Error(`Column count mismatch: DOM has ${columns.length}, matrix has ${expectedCols}`);
	}

	// Iterate through each column
	for (let col = 0; col < expectedCols; col++) {
		const column = columns[col];

		// Find the vlist structure within this column
		const vlist = column.querySelector('.vlist-r .vlist');
		if (!vlist) {
			console.error(`No vlist found in column ${col}`);
			continue;
		}

		const cellContainers = vlist.children;
		if (cellContainers.length !== expectedRows) {
			throw new Error(`Row count mismatch in column ${col}: DOM has ${cellContainers.length}, matrix has ${expectedRows}`);
		}

		// Update each cell in this column
		for (let row = 0; row < expectedRows; row++) {
			const cellContainer = cellContainers[row];
			const cellElement = cellContainer.querySelector('.mord');

			if (!cellElement) {
				console.error(`Cell element not found at row ${row}, col ${col}`);
				continue;
			}

			// Get the new value from the matrix
			let newValue = matrix.get(row, col);

			// Format the value
			if (typeof newValue === 'number') {
				if (Number.isInteger(newValue)) {
					newValue = newValue.toString();
				} else {
					newValue = newValue.toFixed(precision);
				}
			}

			// Update the text content
			cellElement.textContent = newValue;
		}
	}
}

// Functions for animating the process of Gaussian elimination

function runAnimation(div, label) {
	let A = randomNonSingularMatrix(3);
	let b = randomVector(3);
	let steps = gaussianSteps(A, b);

	function nextStep() {
		let step = steps.shift();
		showStep(div, label, step, () => {
			if (steps.length === 0) {
				setTimeout(() => runAnimation(div, label), 500);
			} else {
				setTimeout(nextStep, 500);
			}
		})
	}
	nextStep();
}

function runAnimationMod(div, label, modulus) {
	let A = randomNonSingularMatrixMod(4, modulus);
	let b = randomVectorMod(4, modulus);
	let steps = gaussianStepsMod(A, b, modulus);

	function nextStep() {
		let step = steps.shift();
		showStep(div, label, step, () => {
			if (steps.length === 0) {
				setTimeout(() => runAnimationMod(div, label, modulus), 500);
			} else {
				setTimeout(nextStep, 500);
			}
		})
	}
	nextStep();
}

function timedCalls(calls) {
	if (calls.length === 0)
		return;
	const [delay, fn] = calls.shift();
	setTimeout(() => {
		try {
			fn();
		} finally {
			timedCalls(calls);
		}
	}, delay);
}

function showStep(div, label, step, callback) {
	switch (step.type) {
	case "start":
		showStart(div, label, step, callback);
		break;
	case "choose_pivot":
		showChoosePivot(div, label, step, callback);
		break;
	case "row_swap":
		showRowSwap(div, label, step, callback);
		break;
	case "elimination":
		showElimination(div, label, step, callback);
		break;
	case "final_solution":
		showFinalSolution(div, label, step, callback);
		break;
	default:
		throw new Error("Unknown step type");
	}
}

function showStart(div, label, step, callback) {
	label.innerText = step.description;
	clearMatrixHighlights(div);
	if (div.querySelector('.mtable')) {
		updateMatrixValues(div, step.matrix);
	} else {
		renderAugmentedMatrix(step.matrix, div);
	}
	setTimeout(callback, 1500);
}

function showChoosePivot(div, label, step, callback) {
	label.innerText = step.description;
	highlightMatrixElement(div, step.pivotRow, step.pivotCol);
	updateMatrixValues(div, step.matrix);
	setTimeout(callback, 2500);
}

function showRowSwap(div, label, step, callback) {
	label.innerText = step.description;

	const [row1, row2] = step.swappedRows;

	// Get all row elements before updating values
	const mtable = div.querySelector('.mtable');
	const columns = mtable.querySelectorAll('.col-align-c');

	// Collect all cell elements for both rows
	const row1Elements = [];
	const row2Elements = [];

	columns.forEach(column => {
		const vlist = column.querySelector('.vlist-r .vlist');
		const cells = vlist.children;

		const cell1 = cells[row1]?.querySelector('.mord');
		const cell2 = cells[row2]?.querySelector('.mord');

		if (cell1) row1Elements.push(cell1);
		if (cell2) row2Elements.push(cell2);
	});

	// Calculate the vertical distance between rows
	const rowHeight = 1.2; // em units, same as in KaTeX structure
	const distance = Math.abs(row2 - row1) * rowHeight;
	const direction1 = row2 > row1 ? 1 : -1; // row1 moves down/up
	const direction2 = -direction1; // row2 moves opposite direction

	// Wait briefly after clearing highlights before starting row swap animation
	timedCalls([
		[0, () => {
			clearMatrixHighlights(div);
		}],
		[300, () => {
			// Apply transition style
			[...row1Elements, ...row2Elements].forEach(el => {
				el.style.transition = 'background-color 0.6s ease, padding 0.6s ease, transform 1.2s ease-in-out';
			});
		}],
		[50, () => {
			// Apply other styles
			[...row1Elements, ...row2Elements].forEach(el => {
				el.style.position = 'relative';
				el.style.zIndex = '10';
				el.style.backgroundColor = 'rgba(255, 255, 0, 0.2)';
				el.style.borderRadius = '3px';
				el.style.padding = '1px 1px';
			});
		}],
		[600, () => {
			// Start the sliding animation
			row1Elements.forEach(el => {
				el.style.transform = `translateY(${direction1 * distance}em)`;
			});
			row2Elements.forEach(el => {
				el.style.transform = `translateY(${direction2 * distance}em)`;
			});
		}],
		[1250, () => {
			// Reset background and padding
			[...row1Elements, ...row2Elements].forEach(el => {
				el.style.backgroundColor = '';
				el.style.borderRadius = '';
				el.style.padding = '';
			});
		}],
		[600, () => {
			// Reset transition style
			// (So we don't see animation in reverse when transform is cleared)
			[...row1Elements, ...row2Elements].forEach(el => {
				el.style.transition = '';
			});
		}],
		[50, () => {
			updateMatrixValues(div, step.matrix);

			// Reset remaining styling, including transform
			[...row1Elements, ...row2Elements].forEach(el => {
				el.style.position = '';
				el.style.transform = '';
				el.style.zIndex = '';
			});
		}],
		[1500, callback]
	]);
}

function showElimination(div, label, step, callback) {
	label.innerText = step.description;

	const { eliminatedRow, pivotRow, pivotCol, factor } = step;

	// Get all row elements
	const mtable = div.querySelector('.mtable');
	const columns = mtable.querySelectorAll('.col-align-c');

	// Collect elements for both rows
	const pivotRowElements = [];
	const eliminatedRowElements = [];

	columns.forEach(column => {
		const vlist = column.querySelector('.vlist-r .vlist');
		const cells = vlist.children;

		const pivotCell = cells[pivotRow]?.querySelector('.mord');
		const eliminatedCell = cells[eliminatedRow]?.querySelector('.mord');

		if (pivotCell) pivotRowElements.push(pivotCell);
		if (eliminatedCell) eliminatedRowElements.push(eliminatedCell);
	});

	timedCalls([
		[0, () => {
			clearMatrixHighlights(div);
		}],
		[300, () => {
			// Highlight pivot row in blue
			pivotRowElements.forEach(el => {
				el.style.transition = 'background-color 0.6s ease, padding 0.6s ease';
				el.style.backgroundColor = 'rgba(0, 123, 255, 0.2)';
				el.style.borderRadius = '3px';
				el.style.padding = '1px 1px';
			});
		}],
		[600, () => {
			// Highlight eliminated row in red
			eliminatedRowElements.forEach(el => {
				el.style.transition = 'background-color 0.6s ease, padding 0.6s ease';
				el.style.backgroundColor = 'rgba(220, 53, 69, 0.2)';
				el.style.borderRadius = '3px';
				el.style.padding = '1px 1px';
			});
		}],
		[800, () => {
			// Show the operation visually by pulsing the eliminated row
			eliminatedRowElements.forEach(el => {
				el.style.transition = 'background-color 0.3s ease';
				el.style.backgroundColor = 'rgba(220, 53, 69, 0.4)';
			});
		}],
		[300, () => {
			eliminatedRowElements.forEach(el => {
				el.style.backgroundColor = 'rgba(220, 53, 69, 0.2)';
			});
		}],
		[300, () => {
			eliminatedRowElements.forEach(el => {
				el.style.backgroundColor = 'rgba(220, 53, 69, 0.4)';
			});
		}],
		[300, () => {
			eliminatedRowElements.forEach(el => {
				el.style.backgroundColor = 'rgba(220, 53, 69, 0.2)';
			});
		}],
		[500, () => {
			// Update matrix values
			updateMatrixValues(div, step.matrix);
		}],
		[600, () => {
			// Fade out highlights
			[...pivotRowElements, ...eliminatedRowElements].forEach(el => {
				el.style.backgroundColor = '';
				el.style.borderRadius = '';
				el.style.padding = '';
			});
		}],
		[600, () => {
			// Clear transition styles
			[...pivotRowElements, ...eliminatedRowElements].forEach(el => {
				el.style.transition = '';
			});
		}],
		[1500, callback]
	]);
}

function showFinalSolution(div, label, step, callback) {
	label.innerText = step.description;

	const { solution } = step;
	const n = solution.length;

	// Get matrix elements
	const mtable = div.querySelector('.mtable');
	const columns = mtable.querySelectorAll('.col-align-c');

	// Collect diagonal elements (the solution variables)
	const solutionElements = [];

	for (let i = 0; i < n; i++) {
		const column = columns[i];
		if (column) {
			const vlist = column.querySelector('.vlist-r .vlist');
			const cells = vlist.children;
			const diagonalCell = cells[i]?.querySelector('.mord');
			if (diagonalCell) {
				solutionElements.push(diagonalCell);
			}
		}
	}

	// Also collect the augmented column (final results)
	const augmentedElements = [];
	const lastColumn = columns[columns.length - 1];
	if (lastColumn) {
		const vlist = lastColumn.querySelector('.vlist-r .vlist');
		const cells = vlist.children;
		for (let i = 0; i < n; i++) {
			const cell = cells[i]?.querySelector('.mord');
			if (cell) {
				augmentedElements.push(cell);
			}
		}
	}

	timedCalls([
		[0, () => {
			clearMatrixHighlights(div);
		}],
		[500, () => {
			// Start with a gentle glow on all solution elements
			[...solutionElements, ...augmentedElements].forEach(el => {
				el.style.transition = 'all 0.8s ease';
				el.style.backgroundColor = 'rgba(255, 215, 0, 0.2)';
				el.style.borderRadius = '4px';
				el.style.padding = '2px 2px';
			});
		}],
		[800, () => {
			// Intensify the glow
			[...solutionElements, ...augmentedElements].forEach(el => {
				el.style.backgroundColor = 'rgba(255, 215, 0, 0.4)';
				el.style.boxShadow = '0 0 12px 3px rgba(255, 215, 0, 0.6)';
			});
		}],
		[1000, () => {
			// Gentle fade to a subtle final highlight
			[...solutionElements, ...augmentedElements].forEach(el => {
				el.style.transition = 'all 1s ease';
				el.style.backgroundColor = 'rgba(255, 215, 0, 0.15)';
				el.style.boxShadow = '0 0 8px 2px rgba(255, 215, 0, 0.4)';
			});
		}],
		[2500, () => {
			// Clear styling
			[...solutionElements, ...augmentedElements].forEach(el => {
				el.style.backgroundColor = '';
				el.style.boxShadow = '';
				el.style.padding = '';
				el.style.borderRadius = '';
			});
		}],
		[500, () => {
			[...solutionElements, ...augmentedElements].forEach(el => {
				el.style.transition = '';
			});
		}],
		[2500, callback]
	]);
}
