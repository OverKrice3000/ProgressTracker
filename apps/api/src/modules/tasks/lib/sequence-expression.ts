import { create, all, type MathNode } from 'mathjs';

const math = create(all, {});

const EXPRESSION_BLOCK = /\{([^{}]+)\}/g;

const DISALLOWED_NODE_TYPES = new Set([
  'FunctionNode',
  'AssignmentNode',
  'BlockNode',
  'ConditionalNode',
  'AccessorNode',
  'IndexNode',
  'ObjectNode',
  'RangeNode',
]);

export class SequenceExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SequenceExpressionError';
  }
}

function isAllowedNode(node: MathNode): boolean {
  let ok = true;
  node.traverse((child) => {
    if (DISALLOWED_NODE_TYPES.has(child.type)) {
      ok = false;
    }
    if (child.type === 'SymbolNode' && (child as unknown as { name: string }).name !== 'n') {
      ok = false;
    }
    if (child.type === 'ConstantNode' && typeof (child as unknown as { value: unknown }).value !== 'number') {
      ok = false;
    }
  });
  return ok;
}

export function validateArithmeticExpression(expr: string): string | null {
  const trimmed = expr.trim();
  if (!trimmed) return 'empty';

  let node: MathNode;
  try {
    node = math.parse(trimmed);
  } catch {
    return 'invalid';
  }

  if (!isAllowedNode(node)) return 'invalid';

  try {
    const result = node.compile().evaluate({ n: 1 });
    if (typeof result !== 'number' || !Number.isFinite(result)) {
      return 'notNumber';
    }
  } catch {
    return 'invalid';
  }

  return null;
}

export function evaluateArithmeticExpression(expr: string, taskIndex: number): number {
  const trimmed = expr.trim();
  let node: MathNode;
  try {
    node = math.parse(trimmed);
  } catch {
    throw new SequenceExpressionError('Invalid expression');
  }

  if (!isAllowedNode(node)) {
    throw new SequenceExpressionError('Expression contains unsupported operations');
  }

  const result = node.compile().evaluate({ n: taskIndex });
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new SequenceExpressionError('Expression must evaluate to a finite number');
  }

  return result;
}

export function extractExpressionBlocks(value: string): string[] {
  const blocks: string[] = [];
  const re = new RegExp(EXPRESSION_BLOCK.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

export function substituteExpressionBlocks(text: string, taskIndex: number): string {
  return text.replace(EXPRESSION_BLOCK, (_, expr: string) => {
    const num = evaluateArithmeticExpression(expr, taskIndex);
    return Number.isInteger(num) ? String(num) : String(num);
  });
}

export function resolveNumericTemplate(template: string, taskIndex: number): number {
  const trimmed = template.trim();
  const wrapped = /^\{([^{}]+)\}$/.exec(trimmed);
  if (wrapped) {
    return evaluateArithmeticExpression(wrapped[1], taskIndex);
  }
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  throw new SequenceExpressionError('Numeric field must be a whole number or {expression}');
}

export function assertInteger(value: number, label: string): number {
  if (!Number.isInteger(value)) {
    throw new SequenceExpressionError(`${label} must evaluate to a whole number`);
  }
  return value;
}
