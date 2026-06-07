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
  const node = math.parse(trimmed);
  if (!isAllowedNode(node)) {
    throw new Error('Invalid expression');
  }
  const result = node.compile().evaluate({ n: taskIndex });
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new Error('Not a number');
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

export function validateTextWithExpressions(value: string): string | null {
  for (const expr of extractExpressionBlocks(value)) {
    const err = validateArithmeticExpression(expr);
    if (err) return err;
  }
  return null;
}

export function validateNumericTemplate(
  template: string,
  count: number,
  opts: { min: number; max?: number; requireInteger: boolean },
): string | null {
  const trimmed = template.trim();
  const wrapped = /^\{([^{}]+)\}$/.exec(trimmed);

  if (wrapped) {
    const exprErr = validateArithmeticExpression(wrapped[1]);
    if (exprErr) return exprErr;

    for (let n = 1; n <= count; n++) {
      try {
        const value = evaluateArithmeticExpression(wrapped[1], n);
        if (opts.requireInteger && !Number.isInteger(value)) return 'notInteger';
        if (value < opts.min || (opts.max !== undefined && value > opts.max)) return 'outOfRange';
      } catch {
        return 'invalid';
      }
    }
    return null;
  }

  if (!/^\d+$/.test(trimmed)) return 'invalid';
  const value = parseInt(trimmed, 10);
  if (value < opts.min || (opts.max !== undefined && value > opts.max)) return 'outOfRange';
  return null;
}

export interface SequenceFormValues {
  name: string;
  description: string;
  trackerType: string;
  total: string;
  durationHours: string;
  durationMinutes: string;
  count: number;
}

export function validateSequenceForm(values: SequenceFormValues): string | null {
  const count = Math.max(1, Math.min(100, values.count || 1));

  for (const expr of extractExpressionBlocks(values.name)) {
    const err = validateArithmeticExpression(expr);
    if (err) return 'expressionInvalid';
  }

  if (values.description) {
    for (const expr of extractExpressionBlocks(values.description)) {
      const err = validateArithmeticExpression(expr);
      if (err) return 'expressionInvalid';
    }
  }

  if (values.trackerType === 'NUMBER') {
    const err = validateNumericTemplate(values.total, count, { min: 1, requireInteger: true });
    if (err) return err === 'invalid' || err === 'notInteger' ? 'expressionInvalid' : 'numberOutOfRange';
  }

  if (values.trackerType === 'TIME') {
    const hoursErr = validateNumericTemplate(values.durationHours, count, {
      min: 0,
      requireInteger: true,
    });
    if (hoursErr) return hoursErr === 'invalid' || hoursErr === 'notInteger' ? 'expressionInvalid' : 'numberOutOfRange';

    const minutesErr = validateNumericTemplate(values.durationMinutes, count, {
      min: 0,
      max: 59,
      requireInteger: true,
    });
    if (minutesErr) return minutesErr === 'invalid' || minutesErr === 'notInteger' ? 'expressionInvalid' : 'minutesOutOfRange';

    for (let n = 1; n <= count; n++) {
      try {
        const wrappedH = /^\{([^{}]+)\}$/.exec(values.durationHours.trim());
        const wrappedM = /^\{([^{}]+)\}$/.exec(values.durationMinutes.trim());
        const hours = wrappedH
          ? evaluateArithmeticExpression(wrappedH[1], n)
          : parseInt(values.durationHours, 10) || 0;
        const minutes = wrappedM
          ? evaluateArithmeticExpression(wrappedM[1], n)
          : parseInt(values.durationMinutes, 10) || 0;
        if (hours * 60 + minutes < 1) return 'durationTooShort';
      } catch {
        return 'expressionInvalid';
      }
    }
  }

  return null;
}
