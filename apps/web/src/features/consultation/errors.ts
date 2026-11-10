export type ChatErrorCopy = {
  title: string;
  body: string;
};
const generic: ChatErrorCopy = {
  title: 'Não foi possível concluir',
  body: 'Recarregue a conversa para verificar o histórico antes de tentar novamente.',
};
const copies: Record<string, ChatErrorCopy> = {
  quota: {
    title: 'Limite de uso atingido',
    body: 'Os tokens gratuitos do Gemini para esta chave acabaram. Tente novamente mais tarde.',
  },
  model_unavailable: {
    title: 'Assistente indisponível',
    body: 'Não consegui falar com o provedor do modelo agora. Pode ser uma instabilidade temporária; tente novamente em instantes.',
  },
  invalid_output: {
    title: 'Resposta não validada',
    body: 'O assistente respondeu em um formato que não pude validar. Tente novamente.',
  },
  interrupted: {
    title: 'Resposta interrompida',
    body: 'A conexão terminou antes de a resposta chegar completa. Tente novamente.',
  },
};
export function chatErrorCopy(code?: string | null): ChatErrorCopy {
  return (code && copies[code]) || generic;
}
