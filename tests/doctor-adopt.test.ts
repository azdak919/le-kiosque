import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { doctor, formatDoctorReport } from '../packages/pipeline/src/doctor.ts';
import { adopt } from '../packages/pipeline/src/adopt.ts';
import { normalizeBasePath, type KiosqueConfig } from '../packages/pipeline/src/config.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'examples', 'demo-journal');

function demoConfig(): KiosqueConfig {
  return {
    root,
    source: { adapter: 'markdown' },
    deploy: { basePath: normalizeBasePath('/') },
  } as KiosqueConfig;
}

describe('kiosque doctor', () => {
  it('produit un rapport structuré pour la démo', async () => {
    const report = await doctor(demoConfig());
    assert.equal(report.root, root);
    assert.ok(report.findings.some((f) => f.code === 'node-version'));
    assert.ok(report.findings.some((f) => f.code === 'mirror' && f.level === 'ok'));
    assert.ok(report.findings.some((f) => f.code === 'articles' && f.level === 'ok'));
    const text = formatDoctorReport(report);
    assert.match(text, /LE KIOSQUE — doctor/);
  });
});

describe('kiosque adopt', () => {
  it('génère une checklist markdown de passation', async () => {
    const report = await adopt(demoConfig());
    assert.match(report.markdown, /Passation LE KIOSQUE/);
    assert.ok(report.checklist.some((c) => c.id === 'access' && c.done === false));
    assert.ok(report.checklist.some((c) => c.id === 'mirror' && c.done === true));
  });
});
