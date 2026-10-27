// Manual, read-only SEC smoke test. Never publishes picks or trading signals.
// Usage: SEC_USER_AGENT="Smart Money Scout contact@example.com" node scripts/sec-smoke.mjs 320193
import {fetchRecentOwnershipFilings,retrieveForm4Candidate} from './sec-form4-retrieval.mjs';
const cik=process.argv[2],userAgent=process.env.SEC_USER_AGENT;
if(!/^\d{1,10}$/.test(cik??'')){console.error('Usage: SEC_USER_AGENT="App contact@example.com" node scripts/sec-smoke.mjs <issuer CIK>');process.exitCode=2}
else{
 try{
  const filings=await fetchRecentOwnershipFilings(cik,{userAgent,limit:3});
  console.log(JSON.stringify({issuerCik:cik,discovered:filings.length,filings:filings.map(f=>({accession:f.accession,formType:f.formType,filingDate:f.filingDate,acceptanceTime:f.acceptanceTime,acceptanceTimezone:f.acceptanceTimezone,filingIndexUrl:f.filingIndexUrl}))},null,2));
  if(!filings.length)throw Error('No recent Form 4 in SEC recent index; choose another issuer');
  const candidate=await retrieveForm4Candidate(filings[0],{userAgent});
  console.log(JSON.stringify({accession:candidate.accession,sourceUrl:candidate.sourceUrl,validationStatus:candidate.validationStatus,reportedPurchaseCandidates:candidate.transactions.length,amendment:candidate.formType==='4/A',note:'Audit only. Not reconciled or ranked.'},null,2));
 }catch(e){console.error('SEC smoke test failed:',e.message);process.exitCode=1}
}
