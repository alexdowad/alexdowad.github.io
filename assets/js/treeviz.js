'use strict';

function count(iterable) {
  var result = 0;
  for (const _ of iterable)
    result++;
  return result;
}

function sum(iterable) {
  var result = 0;
  for (const value of iterable)
    result += value;
  return result;
}

function max(iterable) {
  return Math.max(...iterable);
}

function* leaves(node) {
  if (node.value instanceof Array) {
    for (const child of node.value)
      if (child)
        yield* leaves(child);
  } else {
    yield node;
  }
}

function* branches(node) {
  if (node.value instanceof Array) {
    yield node;
    for (const child of node.value)
      if (child)
        yield* branches(child);
  }
}

function* bottomNodes(node) {
  if (node.value instanceof Array && node.value.length) {
    for (const child of node.value)
      if (child)
        yield* bottomNodes(child);
  } else {
    yield node;
  }
}

function depth(node) {
  if (!node) {
    return 0;
  } else if (node.value instanceof Array && node.value.length) {
    return max(node.value.filter((x) => x).map(depth)) + 1;
  } else {
    return 1;
  }
}

const clockwise = Object.freeze([0, 1, -1, 0]); /* 90 degrees */
const counterClockwise = Object.freeze([0, -1, 1, 0]); /* " */

function rotateVector(vector, rotation) {
  /* Just a simple matrix multiply */
  return [
    vector[0]*rotation[0] + vector[1]*rotation[1],
    vector[0]*rotation[2] + vector[1]*rotation[3]
  ];
}

function normalizeVector(vector, length) {
  const actualLength = Math.sqrt(vector[0]*vector[0] + vector[1]*vector[1]);
  const ratio = length / actualLength;
  return [vector[0]*ratio, vector[1]*ratio];
}

function treeWidth(tree, nodeRadius, nodeSpacing) {
  return ((count(bottomNodes(tree)) - 1) * nodeSpacing) + (2 * nodeRadius);
}

function treeHeight(tree, nodeRadius, nodeSpacing) {
  return ((depth(tree) - 1) * nodeSpacing) + (2 * nodeRadius);
}

function initSvg(width, height) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  return svg;
}

function setAttributes(elem, ...attrs) {
  for (var i = 0; i < attrs.length; i += 2)
    elem.setAttribute(attrs[i], attrs[i+1]);
}

function addSvgElement(parent, type, ...attrs) {
  const elem = document.createElementNS('http://www.w3.org/2000/svg', type);
  setAttributes(elem, ...attrs);
  parent.appendChild(elem);
  return elem;
}

/* Generate a SVG which depicts a tree structure. The caller must insert the
 * SVG into the DOM.
 *
 * The provided width/height values define the SVG's coordinate space, which
 * may not correspond to its pixel width/height on the screen. Use CSS to
 * control the size of the SVG on screen.
 *
 * `nodeSpacing` is the desired spacing between the _centers_ of nodes in
 * either the X or Y axis. If it is smaller than `nodeRadius * 2`, nodes
 * will overlap. If there is not enough space to fit all nodes with the
 * requested size and spacing, the size and spacing will be shrunk to fit
 * in the available space. */
function renderTree(tree, dimensions) {
  return renderTrees([tree], dimensions);
}

function renderTrees(trees, {width, height, nodeRadius, nodeSpacing, showWeight, labelLines}) {
  const svg = initSvg(width, height);
  let yPos = 0,
      xPos = 0,
      widths = trees.map((tree) => treeWidth(tree, nodeRadius, nodeSpacing)),
      heights = trees.map((tree) => treeHeight(tree, nodeRadius, nodeSpacing)),
      naturalWidth = sum(widths) + ((trees.length - 1) * nodeSpacing),
      naturalHeight = max(heights),
      paddedWidth = naturalWidth + (nodeSpacing * 2) - (nodeRadius * 2),
      paddedHeight = naturalHeight + (nodeSpacing * 2) - (nodeRadius * 2);

  if (paddedWidth > width || paddedHeight > height) {
    const shrinkRatio = Math.min(width / paddedWidth, height / paddedHeight);
    nodeSpacing *= shrinkRatio;
    nodeRadius  *= shrinkRatio;
    naturalWidth *= shrinkRatio;
    naturalHeight *= shrinkRatio;
    widths = widths.map((w) => w * shrinkRatio);
    heights = heights.map((h) => h * shrinkRatio);
  }

  if (naturalWidth < width) {
    xPos = (width - naturalWidth) / 2;
    width = naturalWidth;
  }
  if (naturalHeight < height) {
    yPos = (height - naturalHeight) / 2;
    height = naturalHeight;
  }

  for (var i = 0; i < trees.length; i++) {
    const treeY = yPos + height - heights[i];
    renderSubtree(trees[i], svg, xPos, treeY, widths[i], heights[i], nodeRadius, nodeSpacing, showWeight, labelLines);
    xPos += widths[i] + nodeSpacing;
  }

  return svg;
}

function renderSubtree(tree, svg, xPos, yPos, width, height, nodeRadius, nodeSpacing, showWeight, labelLines) {
  const parentX = xPos + (width / 2), parentY = yPos + nodeRadius;

  if (tree.value instanceof Array) {
    let childX = xPos, childY = yPos + nodeSpacing, childHeight = height - nodeSpacing;
    for (const child of tree.value) {
      const childWidth = treeWidth(child, nodeRadius, nodeSpacing);

      /* Render line connecting parent node to child */
      addSvgElement(svg, 'line', 'x1', parentX, 'y1', parentY, 'x2', childX + (childWidth / 2), 'y2', childY + nodeRadius);

      if (labelLines) {
        const vector = [childX + (childWidth / 2) - parentX, childY + nodeRadius - parentY];
        const rotation = (vector[0] < 0) ? counterClockwise : clockwise;
        const [dx, dy] = normalizeVector(rotateVector(vector, rotation), nodeRadius * 0.8);
        const midpoint = [parentX + (vector[0] / 2), parentY + (vector[1] / 2)];
        const label = addSvgElement(svg, 'text', 'x', midpoint[0] + dx, 'y', midpoint[1] + dy, 'text-anchor', 'middle', 'dominant-baseline', 'central', 'font-size', nodeRadius * 1.1);
        label.textContent = (childX == xPos) ? '0' : '1';
        label.classList.add('linelabel');
      }

      /* Render subtree */
      renderSubtree(child, svg, childX, childY, childWidth, childHeight, nodeRadius, nodeSpacing, showWeight, labelLines);

      childX += childWidth - (2 * nodeRadius) + nodeSpacing;
    }
  }

  /* Render parent node last */
  addSvgElement(svg, 'circle', 'cx', parentX, 'cy', parentY, 'r', nodeRadius);

  if (!(tree.value instanceof Array)) {
    const textNode = addSvgElement(svg, 'text', 'x', parentX, 'y', parentY - (nodeRadius * 0.07), 'text-anchor', 'middle', 'dominant-baseline', 'central', 'font-size', nodeRadius * 1.5);
    textNode.textContent = (tree.value == ' ') ? '_' : tree.value;
    if (showWeight && tree.weight) {
      const weightNode = addSvgElement(svg, 'text', 'x', parentX + nodeRadius, 'y', parentY, 'dominant-baseline', 'hanging', 'font-size', nodeRadius);
      weightNode.textContent = tree.weight;
    }
  }
}

function animateTreeConstruction(subtreeSequence, {width, height, nodeRadius, nodeSpacing, showWeight}, maxFrames) {
  var elapsedTime = 0;
  const holdTime = 0.9, moveTime = 1;
  const keyframeMap = new Map();
  const lineAppearTimes = new Map(); /* When should line from child to parent appear? */

  function subtreeWidth(subtree) {
    return treeWidth(subtree, nodeRadius, nodeSpacing);
  }

  function subtreeHeight(subtree) {
    return treeHeight(subtree, nodeRadius, nodeSpacing);
  }

  function addKeyframes(subtrees, frameTime) {
    layoutSubtrees(subtrees, 0, 0, width, height);
    elapsedTime += frameTime;
  }

  function layoutSubtrees(subtrees, x, y, width, height) {
    const naturalWidth = sum(subtrees.map(subtreeWidth)) + (nodeSpacing * (subtrees.length - 1));
    let xPos = (width - naturalWidth) / 2;
    for (const subtree of subtrees) {
      const w = subtreeWidth(subtree), h = subtreeHeight(subtree);
      layoutSubtree(subtree, xPos, height - h - nodeSpacing, w, h);
      xPos += w + nodeSpacing;
    }
  }

  function layoutSubtree(subtree, x, y, width, height) {
    addKeyframe(subtree, x + (width / 2), y + nodeRadius);

    if (subtree.value instanceof Array) {
      let childX = x, childY = y + nodeSpacing, childHeight = height - nodeSpacing;
      for (const child of subtree.value) {
        if (!child)
          continue;
        if (!lineAppearTimes.get(child))
          lineAppearTimes.set(child, elapsedTime);
        const childWidth = subtreeWidth(child);
        layoutSubtree(child, childX, childY, childWidth, childHeight);
        childX += childWidth - (2 * nodeRadius) + nodeSpacing;
      }
    }
  }

  function addKeyframe(node, x, y) {
    const keyframeList = keyframeMap.get(node) || [];
    keyframeList.push([x, y, elapsedTime]);
    keyframeMap.set(node, keyframeList);
  }

  function generateAllKeyframes() {
    for (var subtrees of subtreeSequence) {
      addKeyframes(subtrees, holdTime);
      addKeyframes(subtrees, moveTime);
      if (maxFrames && maxFrames-- == 1)
        break;
    }
    addKeyframes(subtrees, holdTime * 2); // Hold a bit longer when the tree is complete
  }

  function processKeyframes(svg) {
    renderLines(svg);
    renderNodes(svg);
    return svg;
  }

  function renderLines(svg) {
    keyframeMap.forEach(function(keyframes, subtree) {
      if (subtree.value instanceof Array) {
        /* Draw lines connecting parent to child nodes */
        for (const child of subtree.value) {
          const line = addSvgElement(svg, 'line');
          const childKeyframes = keyframeMap.get(child);
          const lineAppearTime = lineAppearTimes.get(child);

          if (lineAppearTime) {
            animateSvgAttribute(line, 'x1', keyframes, 0);
            animateSvgAttribute(line, 'y1', keyframes, 1);
            animateSvgAttribute(line, 'x2', childKeyframes, 0);
            animateSvgAttribute(line, 'y2', childKeyframes, 1);
            setSvgAppearTime(line, lineAppearTime);
          }
        }
      }
    });
  }

  function renderNodes(svg) {
    keyframeMap.forEach(function(keyframes, subtree) {
      const circle = addSvgElement(svg, 'circle', 'r', nodeRadius);
      animateSvgElement(circle, keyframes, 'cx', 'cy');

      if (!(subtree.value instanceof Array)) {
        if (subtree.dummy)
          circle.classList.add('dummy');
        const textNode = addSvgElement(svg, 'text', 'text-anchor', 'middle', 'dominant-baseline', 'central', 'font-size', nodeRadius * 1.5, 'dy', nodeRadius * -0.07);
        textNode.textContent = (subtree.value == ' ') ? '_' : subtree.value;
        animateSvgElement(textNode, keyframes, 'x', 'y');
      }

      if (showWeight && subtree.weight) {
        const weightNode = addSvgElement(svg, 'text', 'dominant-baseline', 'hanging', 'font-size', nodeRadius, 'dx', nodeRadius, 'dy', nodeRadius * -0.37);
        weightNode.textContent = subtree.weight;
        animateSvgElement(weightNode, keyframes, 'x', 'y');
      }
    });
  }

  function animateSvgAttribute(elem, attr, keyframes, index) {
    const keyTimes = "0;" + keyframes.map((kf) => kf[2] / elapsedTime).join(";") + ";1";
    const values = keyframes[0][index] + ";" + keyframes.map((kf) => kf[index]).join(";") + ";" + keyframes[keyframes.length-1][index];
    addSvgElement(elem, 'animate', 'attributeName', attr, 'values', values, 'keyTimes', keyTimes, 'dur', elapsedTime + 's', 'repeatCount', 'indefinite');
  }

  function setSvgAppearTime(elem, appearTime) {
    if (appearTime) {
      addSvgElement(elem, 'animate', 'attributeName', 'visibility', 'values', 'hidden;visible',
        'keyTimes', '0;' + (appearTime / elapsedTime), 'calcMode', 'discrete', 'dur', elapsedTime + 's', 'repeatCount', 'indefinite');
    }
  }

  function animateSvgElement(elem, keyframes, xAttr, yAttr) {
    animateSvgAttribute(elem, xAttr, keyframes, 0);
    animateSvgAttribute(elem, yAttr, keyframes, 1);
    setSvgAppearTime(elem, keyframes[0][2]);
  }

  generateAllKeyframes();
  return processKeyframes(initSvg(width, height));
}

function randomBottomUpTreeBuilder(subtrees) {
  var a, b;
  do {
    a = Math.floor(Math.random() * subtrees.length);
    b = Math.floor(Math.random() * subtrees.length);
  } while (a >= b);

  const newNode = { value: [subtrees[a], subtrees[b]], weight: subtrees[a].weight + subtrees[b].weight };
  subtrees.splice(b, 1);
  subtrees.splice(a, 1);
  subtrees.unshift(newNode);
  return subtrees;
}

function* treeSequence(leaves, builder) {
  var subtrees = Array.from(leaves);
  while (subtrees.length > 1) {
    yield subtrees;
    subtrees = builder(subtrees);
  }
  yield subtrees;
}

function animateRandomBottomUpTree(leaves, dimensions) {
  return animateTreeConstruction(treeSequence(leaves, randomBottomUpTreeBuilder), dimensions);
}

function randomTopDownTreeBuilder(subtrees) {
  if (subtrees[0].root) {
    const rootNode = subtrees[0];
    if (count(branches(rootNode)) >= subtrees.length-2) {
      /* Branches are all in place, attach leaves in random positions */
      const leafIndex = 1 + Math.floor(Math.random() * (subtrees.length - 1));
      let position = Math.floor(Math.random() * (subtrees.length - 1));
      let node = rootNode;
      while (true) {
        if (!node.value[0] && position === 0) {
          node.value[0] = subtrees[leafIndex];
          subtrees.splice(leafIndex, 1);
          break;
        } else {
          const freeSpots = node.value[0] ? (count(branches(node.value[0])) + 1) - count(leaves(node.value[0])) : 1;
          if (position < freeSpots) {
            /* Recur on left side */
            node = node.value[0];
          } else if (!node.value[1]) {
            node.value[1] = subtrees[leafIndex];
            subtrees.splice(leafIndex, 1);
            break;
          } else {
            position -= freeSpots;
            node = node.value[1];
          }
        }
      }
    } else {
      /* Add another branch at a random position */
      let node = rootNode;
      while (true) {
        const direction = (Math.random() > 0.5) ? 0 : 1;
        if (node.value[direction]) {
          node = node.value[direction];
        } else {
          node.value[direction] = { value: [] };
          break;
        }
      }
    }
  } else {
    subtrees.unshift({ value: [], root: true });
  }
  return subtrees;
}

function animateRandomTopDownTree(leaves, dimensions) {
  return animateTreeConstruction(treeSequence(leaves, randomTopDownTreeBuilder), dimensions);
}

function optimalTreeBuilder(subtrees) {
  subtrees.sort((a, b) => a.weight < b.weight ? -1 : 1);
  const newNode = { value: [subtrees[0], subtrees[1]], weight: subtrees[0].weight + subtrees[1].weight };
  subtrees.splice(0, 2, newNode);
  return subtrees;
}

function animateOptimalTree(leaves, dimensions, maxFrames) {
  return animateTreeConstruction(treeSequence(leaves, optimalTreeBuilder), dimensions, maxFrames);
}

function dummyTreeBuilder(subtrees) {
  subtrees.sort((a, b) => a.weight < b.weight ? -1 : 1);
  let a = subtrees[0], b = subtrees[1];
  if (a.dummy) {
    let temp = a; a = b; b = temp;
  }
  const newNode = { value: [a, b], weight: a.weight + b.weight, dummy: a.dummy || b.dummy };
  subtrees.splice(0, 2, newNode);
  return subtrees;
}

function animateDummyTree(leaves, dimensions) {
  return animateTreeConstruction(treeSequence(leaves, dummyTreeBuilder), dimensions);
}

export {
  renderTree,
  renderTrees,
  animateRandomBottomUpTree,
  animateRandomTopDownTree,
  animateOptimalTree,
  animateDummyTree
};
