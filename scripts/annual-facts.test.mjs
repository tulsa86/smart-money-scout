import {test} from 'node:test';
import assert from 'node:assert/strict';
import {annualFacts} from './annual-facts.mjs';
const fact=(val,start,end,filed,form='10-K')=>({val,start,end,filed,form,fp:'FY',fy:2025,accn:'0000000001-25-000001'});
test('only annual 10-K values and earliest filing are retained',()=>{
 const x={facts:{'us-gaap':{RevenueFromContractWithCustomerExcludingAssessedTax:{units:{USD:[
 fact(100,'2024-01-01','2024-12-31','2025-02-01'),
 fact(999,'2024-01-01','2024-12-31','2025-04-01'),
 fact(22,'2024-10-01','2024-12-31','2025-02-01'),
 fact(44,'2024-01-01','2024-12-31','2025-02-01','10-Q')
 ]}},NetIncomeLoss:{units:{USD:[fact(10,'2024-01-01','2024-12-31','2025-02-01')]}}}}};
 const out=annualFacts(x);assert.equal(out.revenue.length,1);assert.equal(out.revenue[0].value,100);assert.equal(out.revenue[0].filed,'2025-02-01');
});
test('rejects missing facts',()=>assert.throws(()=>annualFacts({})));
