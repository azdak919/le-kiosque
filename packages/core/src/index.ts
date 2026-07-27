/**
 * LE KIOSQUE — noyau. Point d'entrée unique.
 *
 * `packages/core` n'a aucune dépendance et ne fait aucun appel réseau. C'est
 * voulu : c'est le seul module dont on veut être certain qu'il fonctionnera
 * encore dans dix ans.
 */

export * from './model.ts';
export * from './source.ts';
export * from './validate.ts';
export { runConformanceSuite, formatConformanceReport } from './testkit.ts';
export type { ConformanceOptions, ConformanceReport, CheckResult } from './testkit.ts';
