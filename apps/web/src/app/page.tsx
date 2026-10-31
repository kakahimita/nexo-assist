import { SystemStatus } from '../features/system-status/system-status';

export default function HomePage(): React.JSX.Element {
  return (
    <main>
      <h1>Nexo Assist</h1>
      <p className="subtitle">Fundação técnica — diagnóstico de conexão</p>
      <SystemStatus />
    </main>
  );
}
