/* Count how many times each character appears in a string */
function histogram(string) {
  const histogram = new Map();
  for (const char of string)
    histogram.set(char, (histogram.get(char) || 0) + 1);
  return histogram;
}

function symbols(histogram) {
  return Array.from(histogram).map(([char, count]) => ({ value: char, weight: count }));
}

function huffmanTree(symbols) {
  const heap = new Minheap((a,b) => a.weight > b.weight);
  for (const symbol of symbols)
    heap.insert(symbol);

  while (heap.length > 1) {
    const a = heap.pop(), b = heap.pop();
    heap.insert({ value: [a, b], weight: a.weight + b.weight });
  }

  return heap.pop();
}
