export function isUnsupportedQuickReply(reply: string): boolean {
  const text = reply
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  const write =
    /\b(?:abrir|abra|criar|crie|atualizar|atualize|reabrir|reabra)\b/.test(text) &&
    /\b(?:chamados?|tickets?|solicitac(?:ao|oes))\b/.test(text);
  const handoff =
    /\b(?:falar|chamar|contatar|transferir|conversar)\b/.test(text) &&
    /\b(?:atendente|analista|humano)\b/.test(text);
  const deviceOperation = /\b(?:reinstalar|reinstale|instalar|instale|reiniciar|reinicie)\b/.test(
    text,
  );
  return write || handoff || deviceOperation;
}
