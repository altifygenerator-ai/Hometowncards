import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync('supabase/fix-ebay-classification-conflict-metrics.sql','utf8');
const sync=readFileSync('lib/server/ebay-sync.ts','utf8');
assert(sql.includes("elsif row_result='conflict' then conflicts:=conflicts+1"),'Only real stock conflicts increment conflict count');
assert(sql.includes("'review',conflicts"),'Reported reservation review must be true stock conflicts');
assert(sql.includes("'unknown',reviewed"),'Unknown noncards must have a separate category-review count');
assert(sync.includes("last_error:review?'Stock overlaps"),'Actual conflicts can still surface urgent warning');
console.log('eBay real stock conflicts and classification review are tracked independently.');
