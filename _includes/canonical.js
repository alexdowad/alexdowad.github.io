/* `lengths` is a sorted array of bitstring lengths required for an optimal code
 *
 * In real applications, an array of counts would likely be passed: how many
 * bitstrings must have 1 bit, how many 2 bits, how many 3 bits, and so on
 *
 * Also, in real applications, the returned values would almost certainly
 * not be strings; integers would be more likely */
function makeCanonical(lengths) {
  let result = [], nextCode = 0;
  for (var i = 0; i < lengths.length; i++) {
    if (i > 0 && lengths[i] !== lengths[i-1])
      nextCode <<= 1;
    result.push(nextCode.toString(2).padStart(lengths[i], '0'));
    nextCode++;
  }
  return result;
}
