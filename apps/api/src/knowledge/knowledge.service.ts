import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { KnowledgePlatform } from './articles.js';

export type { KnowledgePlatform } from './articles.js';
type Platform = 'windows10' | 'windows11' | 'unknown';
type Applicability = 'applicable' | 'platform_mismatch' | 'platform_unknown';
export type KnowledgeMatch = { id: string; title: string; summary: string; body: string; platform: KnowledgePlatform; applicability: Applicability; reason: string };
const normalize = (value: string): string => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
export function normalizePlatform(input: string | undefined): Platform {
  const value = normalize(input ?? '').replace(/[^a-z0-9]/g, '');
  if (value === 'windows10' || value === 'win10') return 'windows10';
  if (value === 'windows11' || value === 'win11') return 'windows11';
  return 'unknown';
}
export function assessApplicability(article: { platform: KnowledgePlatform }, platform: Platform): { applicability: Applicability; reason: string } {
  if (article.platform === 'any' || article.platform === platform) return { applicability: 'applicable', reason: 'Compatível com a plataforma informada.' };
  if (platform === 'unknown') return { applicability: 'platform_unknown', reason: 'É necessário informar a versão do Windows.' };
  return { applicability: 'platform_mismatch', reason: 'Artigo destinado a outra versão do Windows.' };
}
const stopWords = new Set(['a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'um', 'uma', 'e', 'com', 'para', 'por', 'que', 'meu', 'minha']);
const tokens = (text: string): string[] => normalize(text).split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1 && !stopWords.has(word));
@Injectable()
export class KnowledgeService {
  constructor(private readonly database: DatabaseService) {}
  async search(query: string, platform: string | undefined): Promise<KnowledgeMatch[]> {
    const words = [...new Set(tokens(query))];
    const rows = await this.database.client.knowledgeArticle.findMany();
    return rows.map((article) => {
      const terms = new Set(tokens(`${article.keywords} ${article.title} ${article.summary}`));
      const score = words.filter((word) => terms.has(word)).length;
      const articlePlatform = article.platform as KnowledgePlatform;
      return { score, id: article.id, title: article.title, summary: article.summary, body: article.body, platform: articlePlatform, ...assessApplicability({ platform: articlePlatform }, normalizePlatform(platform)) };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 5).map(({ score: _score, ...match }) => match);
  }
}
