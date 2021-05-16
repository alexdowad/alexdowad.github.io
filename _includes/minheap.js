class Minheap {
  /* `comparator` must return true if first argument is 'larger' than second */
  constructor(comparator) {
    this.heap = [];
    this.compare = comparator;
  }

  get length() {
    return this.heap.length;
  }

  insert(item) {
    let index = this.heap.length;

    while (index > 0) {
      const parentIndex = ((index + 1) >>> 1) - 1;
      if (this.compare(item, this.heap[parentIndex]))
        break;
      this.heap[index] = this.heap[parentIndex];
      index = parentIndex;
    }

    this.heap[index] = item;
  }

  /* Remove and return the smallest item in the heap */
  pop() {
    const result = this.heap[0], item = this.heap.pop();

    /* If the heap is not empty, move items upward to restore the heap property,
     * until we find an appropriate place to put `item` */
    if (this.heap.length) {
      let index = 0;
      while (true) {
        const leftIndex = (index << 1) + 1, rightIndex = leftIndex + 1;
        let childIndex = leftIndex;

        if (rightIndex < this.heap.length) {
          if (this.compare(this.heap[leftIndex], this.heap[rightIndex]))
            childIndex = rightIndex;
        } else if (leftIndex >= this.heap.length) {
          break;
        }

        if (this.compare(item, this.heap[childIndex])) {
          this.heap[index] = this.heap[childIndex];
          index = childIndex;
        } else {
          break;
        }
      }
      this.heap[index] = item;
    }

    return result;
  }
}
