import {describe,expect,it} from 'vitest';
import registry from '../institutional-contacts.json';
import {institutionalContact} from '../src/contacts';

describe('institutional contacts',()=>{
  it('returns only current reviewed contacts and withdraws expired numbers',()=>{
    const today='2026-11-23';
    expect(institutionalContact('0015466',today)).toMatchObject({status:'published',source_kind:'municipality',phones:[{number:'+554132234114'},{number:'+554132337199'}]});
    for(const date of ['2026-11-22','2027-02-22'])expect(institutionalContact('0015466',date)).toMatchObject({status:'not_verified',phones:[],email:null});
    expect(institutionalContact('0000000',today)).toMatchObject({status:'not_verified',source_url:null,phones:[]});
  });
  it('labels a shared APAE administrative central rather than a direct unit line',()=>{
    for(const code of ['3282910','3282961','3282929']){
      expect(institutionalContact(code,'2026-11-23')).toMatchObject({phones:[{number:'+554133229339',label:expect.stringContaining('não é linha direta')}]});
    }
  });
  it('distinguishes a CNES number from an institutional website and avoids the unrelated FEPE',()=>{
    expect(institutionalContact('5750075','2026-11-23')).toMatchObject({source_kind:'cnes',website:null,email:null,source_updated_on:expect.any(String)});
    expect(institutionalContact('2774925','2026-11-23')).toMatchObject({source_kind:'institution',email:'contato@fepe.org.br',website:'https://www.fepe.org.br/contato/'});
  });
  it('contains safe Brazilian phone links, provenance and no inferred WhatsApp',()=>{
    expect(new Set(registry.entries.map(e=>e.cnes_code)).size).toBe(registry.entries.length);
    for(const entry of registry.entries){
      expect(entry.cnes_code).toMatch(/^[0-9]{7}$/);
      expect(new URL(entry.source_url).protocol).toBe('https:');
      for(const phone of entry.phones) expect(phone.number).toMatch(/^\+55[1-9][0-9][0-9]{8,9}$/);
      expect(Date.parse(entry.review_due_on)-Date.parse(entry.reviewed_on)).toBeLessThanOrEqual(90*86400000);
      expect(JSON.stringify(entry)).not.toContain('wa.me');
    }
  });
});
