import test from 'node:test';
import assert from 'node:assert/strict';
import {canRead,canReport,canReview,validateManualReport,UUID_RE} from '../server/policy.mjs';

test('roles are enforced by server policy, not browser labels',()=>{
  assert.equal(canRead('operator'),true);
  assert.equal(canRead('reviewer'),true);
  assert.equal(canRead('admin'),true);
  assert.equal(canRead('guest'),false);
  assert.equal(canReport('reviewer'),false);
  assert.equal(canReport('operator'),true);
  assert.equal(canReview('reviewer','user_abcdef123','user_fedcba321'),true);
  assert.equal(canReview('reviewer','user_abcdef123','user_abcdef123'),false);
  assert.equal(canReview('operator','user_abcdef123','user_fedcba321'),false);
  assert.equal(canReview('admin','user_abcdef123','user_abcdef123'),false);
});
test('manual report validation rejects blank and out-of-scope data',()=>{
  assert.equal(validateManualReport(null),null);
  assert.equal(validateManualReport({category:'other',title:'X',description:'Valid content here'}),null);
  assert.equal(validateManualReport({category:'other',title:'Broken fridge',description:'short'}),null);
  assert.equal(validateManualReport({category:'unsafe_release',title:'Broken fridge',description:'Valid long content'}),null);
  assert.deepEqual(validateManualReport({category:'equipment_problem',title:'  Door not sealing  ',description:'  Staff observed gasket damage  '}),{
    category:'equipment_problem',title:'Door not sealing',description:'Staff observed gasket damage'
  });
});
test('facility IDs are tightly validated',()=>{
  assert.equal(UUID_RE.test('not-a-uuid'),false);
  assert.equal(UUID_RE.test('00000000-0000-4000-8000-000000000001'),true);
});
