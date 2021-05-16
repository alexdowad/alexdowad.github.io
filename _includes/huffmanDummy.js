/* Count how many times each character appears in a string */
function histogram(string) {
  const histogram = new Map();
  for (const char of string)
    histogram.set(char, (histogram.get(char) || 0) + 1);
  return histogram;
}

function symbols(histogram) {
  const sym = Array.from(histogram).map(([char, count]) => ({ value: char, weight: count }));
  sym.push({ value: "🃏", weight: 0, dummy: true });
  return sym;
}

function huffmanTree(symbols) {
  const heap = new Minheap((a,b) => a.weight > b.weight);
  for (const symbol of symbols)
    heap.insert(symbol);

  while (heap.length > 1) {
    let a = heap.pop(), b = heap.pop();
    if (a.dummy) {
      /* Dummy must always be on the right-hand side */
      let temp = a; a = b; b = temp;
    }
    const parent = { value: [a, b], weight: a.weight + b.weight, dummy: a.dummy || b.dummy };
    heap.insert(parent);
  }

  return heap.pop();
}
