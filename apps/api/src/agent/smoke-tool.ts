import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const EchoInputSchema = z.strictObject({
  nonce: z.string().uuid(),
});

export const EchoOutputSchema = z.strictObject({
  nonce: z.string().uuid(),
  source: z.literal('foundation-smoke'),
});

export type EchoInput = z.infer<typeof EchoInputSchema>;
export type EchoOutput = z.infer<typeof EchoOutputSchema>;

const DESCRIPTION =
  'Returns the supplied nonce unchanged to prove that the model executed this tool. ' +
  'It reads no records, accepts no identity, and changes no state.';

export function createSmokeTool(onExecute: (input: EchoInput, output: EchoOutput) => void) {
  return createTool({
    id: 'foundation-echo',
    description: DESCRIPTION,
    inputSchema: EchoInputSchema,
    outputSchema: EchoOutputSchema,
    execute: async (inputData) => {
      const output: EchoOutput = { nonce: inputData.nonce, source: 'foundation-smoke' };

      onExecute(inputData, output);

      return output;
    },
  });
}
