import { resolve } from 'node:path';
import { config as loadEnvironment } from 'dotenv';
import { createTestDatabase } from '../test/support/test-database.js';
import { REPOSITORY_ROOT } from '../src/config/paths.js';
import { DatabaseService } from '../src/database/database.service.js';
import { FailureSimulator } from '../src/tickets/failure-simulator.js';
import { PrismaTicketService } from '../src/tickets/prisma-ticket-service.js';
import { KnowledgeService } from '../src/knowledge/knowledge.service.js';
import { ConsultationTools } from '../src/agent/tools/consultation-tools.js';
import { createMastraConsultation } from '../src/agent/consultation/mastra-consultation.js';
import { ConsultationTurn } from '../src/agent/consultation/turn.js';
import { validateLiveCase, type LiveCase } from '../src/agent/consultation/live-evaluation.js';
import { parseModelEnvironment } from '../src/agent/model-config.js';

loadEnvironment({ path: resolve(REPOSITORY_ROOT, '.env'), override: false, quiet: true });
const cases: Array<{ id: LiveCase; prompt: string }> = [
  { id: 'vpn10', prompt: 'Meu notebook com Windows 10 mostra o erro 809 na VPN. O que posso fazer?' },
  { id: 'vpn11', prompt: 'Meu notebook com Windows 11 mostra o erro 809 na VPN. O que posso fazer?' },
  { id: 'unknown-platform', prompt: 'Meu notebook mostra o erro 809 na VPN. O que posso fazer?' },
  { id: 'status', prompt: 'Qual o status do meu chamado?' },
  { id: 'unknown-reference', prompt: 'Qual o status do chamado INC-99999?' },
  { id: 'out-of-scope', prompt: 'Como solicitar férias ao RH?' },
];
async function main(): Promise<void> {
  let configuration;
  try { configuration = parseModelEnvironment(process.env); } catch { console.error('Configure GOOGLE_API_KEY e o modelo local para executar a avaliação real.'); process.exitCode = 1; return; }
  console.log(`Provedor: ${configuration.provider}; modelo: ${configuration.model}; fonte: live`);
  const db = await createTestDatabase(); const database = new DatabaseService(db.url);
  try {
    const row = await database.client.user.findUniqueOrThrow({ where: { email: 'ana.souza@nexo.com.br' } });
    const user = { id: row.id, email: row.email, name: row.name, role: 'employee' as const };
    const engine = createMastraConsultation(new ConsultationTools(new PrismaTicketService(database, new FailureSimulator()), new KnowledgeService(database)));
    console.log(`Prompt: ${engine.promptVersion}`);
    for (const scenario of cases) {
      const turn = new ConsultationTurn(); let usage: unknown; let finished = false; const started = Date.now();
      try {
        for await (const event of engine.run({ user, messages: [{ role: 'employee', content: scenario.prompt }], signal: AbortSignal.timeout(60000), now: new Date() })) { turn.apply(event); if (event.type === 'finish') { usage = event.usage; finished = true; } }
        const snapshot = turn.snapshot(); const failures = validateLiveCase(scenario.id, snapshot); if (!finished) failures.push('missing finish');
        console.log(JSON.stringify({ case: scenario.id, result: failures.length ? 'FAIL' : 'PASS', failures, durationMs: Date.now() - started, usage, decision: snapshot.decision, actions: snapshot.actions, evidence: snapshot.evidence }));
        if (failures.length) process.exitCode = 1;
      } catch { console.log(JSON.stringify({ case: scenario.id, result: 'FAIL', durationMs: Date.now() - started, error: 'model execution or validation failed' })); process.exitCode = 1; }
    }
  } finally { await database.onModuleDestroy(); await db.cleanup(); }
}
await main();
