import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { activeMembership, canDecideReview, isAllowedOrigin, membershipAllows } from '../src/access-policy.mjs';

const row = {
  active: true,
  role: 'operator',
  clerk_org_id: 'org_hackathon',
  clerk_user_id: 'user_worker1',
  facility_id: 'facility-test',
  facility_name: 'Synthetic Facility'
};

test('facility membership is scoped to verified Clerk org and user', () => {
  assert.equal(activeMembership(row, 'org_hackathon', 'user_worker1').role, 'operator');
  assert.equal(activeMembership(row, 'org_unrelated', 'user_worker1'), null);
  assert.equal(activeMembership(row, 'org_hackathon', 'user_attacker'), null);
  assert.equal(activeMembership({ ...row, active: false }, 'org_hackathon', 'user_worker1'), null);
  assert.equal(activeMembership({ ...row, role: 'superadmin' }, 'org_hackathon', 'user_worker1'), null);
});

test('operator, reviewer and admin permissions are separate', () => {
  assert.equal(membershipAllows(row, 'investigation:submit'), true);
  assert.equal(membershipAllows(row, 'review:decide'), false);
  assert.equal(membershipAllows({ ...row, role: 'reviewer' }, 'review:decide'), true);
  assert.equal(membershipAllows({ ...row, role: 'admin' }, 'review:decide'), false);
  assert.equal(membershipAllows({ ...row, role: 'admin' }, 'membership:manage'), true);
  assert.equal(membershipAllows({ ...row, active: false }, 'incident:read'), false);
});

test('reviewer cannot approve own submitted investigation', () => {
  const reviewer = { ...row, role: 'reviewer' };
  assert.equal(canDecideReview(reviewer, 'user_2', 'user_1'), true);
  assert.equal(canDecideReview(reviewer, 'user_1', 'user_1'), false);
  assert.equal(canDecideReview(row, 'user_2', 'user_1'), false);
});

test('claimed sign-in origin cannot differ from app origin', () => {
  assert.equal(isAllowedOrigin('https://trustledger-bct-2026.vercel.app', 'https://trustledger-bct-2026.vercel.app'), true);
  assert.equal(isAllowedOrigin('https://malicious.example', 'https://trustledger-bct-2026.vercel.app'), false);
  assert.equal(isAllowedOrigin(undefined, 'http://localhost:3000'), false);
});

test('SQL schema contains audited source lineage and append-only timeline', () => {
  const sql = readFileSync(new URL('../db/migrations/001_trustledger_core.sql', import.meta.url), 'utf8');
  for (const table of ['facilities','facility_memberships','data_sources','source_imports','source_readings','incidents','incident_evidence','incident_events','incident_followups']) {
    assert.match(sql, new RegExp('CREATE TABLE IF NOT EXISTS ' + table + '\\b'));
  }
  assert.match(sql, /CREATE TRIGGER incident_events_append_only/);
  assert.match(sql, /BEFORE UPDATE OR DELETE ON incident_events/);
  assert.match(sql, /original_sha256/);
  assert.match(sql, /raw_fields jsonb NOT NULL/);
  assert.match(sql, /synthetic_only = true/);
});
