import { describe, expect, it } from 'vitest';
import app, {type Env} from '../src/index';
import {supportGuide} from '../src/support-guide';

describe('reviewed support guide',()=>{
  it('serves the editorial corpus without a database or an AI credential',async()=>{
    const response=await app.fetch(new Request('https://example.test/v1/support-guide'),{} as Env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({mode:'document_retrieval',experimental:true});
  });
  it('rejects questions and other query parameters rather than handling personal information',async()=>{
    for(const query of ['?q=example','?topic=adults']){
      const response=await app.fetch(new Request('https://example.test/v1/support-guide'+query),{} as Env);
      expect(response.status).toBe(400);
      expect(await response.text()).not.toContain('example');
    }
  });
  it('withdraws the corpus after review expires and before review begins',()=>{
    expect(supportGuide('2026-11-23').documents).toHaveLength(4);
    expect(supportGuide('2026-11-22').documents).toHaveLength(0);
    expect(supportGuide('2027-02-21').documents).toHaveLength(4);
    expect(supportGuide('2027-02-22').documents).toHaveLength(0);
  });
  it('retains source, dates and scope for every summary and separates adult uncertainty',()=>{
    const docs=supportGuide('2026-11-23').documents;
    expect(new Set(docs.map(doc=>doc.id)).size).toBe(docs.length);
    for(const doc of docs){
      expect(new URL(doc.source_url).hostname.endsWith('.gov.br')).toBe(true);
      expect(doc.steps.length).toBeGreaterThan(0);
      expect(Date.parse(doc.source_published_on!)).toBeLessThanOrEqual(Date.parse(doc.reviewed_on));
      expect(Date.parse(doc.review_due_on)-Date.parse(doc.reviewed_on)).toBeLessThanOrEqual(90*86400000);
    }
    expect(docs.find(doc=>doc.id==='adults')!.summary).toContain('ainda não documentou');
  });
});
