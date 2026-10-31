import { isValidationError } from '@mastra/core/tools';
import { describe, expect, it, vi } from 'vitest';

import { createSmokeTool } from './smoke-tool.js';
import type { EchoInput } from './smoke-tool.js';

const NONCE = '123e4567-e89b-42d3-a456-426614174000';

function execute(tool: ReturnType<typeof createSmokeTool>, input: unknown): Promise<unknown> {
  if (tool.execute === undefined) {
    throw new Error('The smoke tool must expose an execute entrypoint.');
  }

  // The model supplies untyped arguments; this cast deliberately exercises the
  // real validation boundary instead of a copied schema.
  return tool.execute(input as EchoInput, {});
}

describe('createSmokeTool', () => {
  it('B17: exposes the foundation-echo identifier and strict schemas', () => {
    const tool = createSmokeTool(() => undefined);

    expect(tool.id).toBe('foundation-echo');
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('B17: rejects an invalid nonce before the observer runs', async () => {
    const onExecute = vi.fn();
    const tool = createSmokeTool(onExecute);
    const result = await execute(tool, { nonce: 'not-a-uuid' });

    expect(isValidationError(result)).toBe(true);
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('B17: rejects extra identity fields before the observer runs', async () => {
    const onExecute = vi.fn();
    const tool = createSmokeTool(onExecute);
    const result = await execute(tool, { nonce: NONCE, employeeId: 'employee-1' });

    expect(isValidationError(result)).toBe(true);
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('B17: returns the exact echo output and records one execution', async () => {
    const onExecute = vi.fn();
    const tool = createSmokeTool(onExecute);
    const result = await execute(tool, { nonce: NONCE });

    expect(result).toEqual({ nonce: NONCE, source: 'foundation-smoke' });
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledWith(
      { nonce: NONCE },
      { nonce: NONCE, source: 'foundation-smoke' },
    );
  });
});
