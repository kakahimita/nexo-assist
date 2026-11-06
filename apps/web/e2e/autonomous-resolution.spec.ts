import { expect, test } from '@playwright/test';
import { startFreshConversation } from './employee-chat';

test('B02/B04/B09/B10/B11: failed guidance becomes a confirmed ticket with analyst continuity', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('bruno.lima@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('demo');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await startFreshConversation(page);
  const chat = page.getByRole('region', { name: 'Conversa' });
  await chat.getByLabel('Mensagem').fill('Meu monitor está sem imagem');
  const sent = page.waitForRequest(
    (request) => request.url().endsWith('/messages/stream') && request.method() === 'POST',
  );
  await chat.getByRole('button', { name: 'Enviar', exact: true }).click();
  const id = new URL((await sent).url()).pathname.split('/')[3]!;
  await expect(chat.getByText(/Verifique os cabos/)).toBeVisible();
  await chat.getByRole('button', { name: 'Não resolveu', exact: true }).click();
  await chat.getByRole('button', { name: 'Somente eu', exact: true }).click();
  await chat.getByRole('button', { name: 'Não consigo trabalhar', exact: true }).click();
  await chat.getByRole('button', { name: 'Sem compromisso em risco hoje', exact: true }).click();
  const draft = chat.getByRole('article', { name: 'Rascunho do chamado' });
  await expect(draft.getByText('Aguardando confirmação')).toBeVisible();
  await expect(chat.getByText(/Aguardando atendimento humano/)).toHaveCount(0);
  await draft.getByRole('button', { name: 'Confirmar rascunho' }).click();
  await expect(chat.getByText(/Aguardando atendimento humano/)).toBeVisible();
  await chat.getByLabel('Mensagem').fill('Mais um detalhe: a luz do monitor está acesa.');
  await chat.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(
    chat.getByText('Mais um detalhe: a luz do monitor está acesa.', { exact: true }),
  ).toBeVisible();
  await expect(chat.getByText('Preparando resposta...')).toHaveCount(0);
  await page.screenshot({ path: 'outputs/autonomous-resolution-waiting.png', fullPage: true });
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await page.getByLabel('E-mail corporativo').fill('analista@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('demo');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('button', { name: 'Para você', exact: true }).click();
  await page.locator(`[data-conversation-id="${id}"]`).click();
  await expect(
    page
      .getByRole('region', { name: 'Desta conversa' })
      .getByText('Meu monitor está sem imagem', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Assumir atendimento', exact: true }).click();
  await page.getByLabel('Resposta').fill('Já li as tentativas. Vou verificar o monitor.');
  const refreshed = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === `/api/support/conversations/${id}`,
  );
  await page.getByRole('button', { name: 'Enviar resposta', exact: true }).click();
  await refreshed;
  await expect(
    page.getByText('Já li as tentativas. Vou verificar o monitor.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Resposta')).toBeEnabled();
  await page.screenshot({ path: 'outputs/autonomous-resolution-analyst.png', fullPage: true });
});
