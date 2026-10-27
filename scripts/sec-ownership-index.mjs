// SEC submissions discovery only: does not fetch or validate ownership XML.
const validAccession=x=>typeof x==='string'&&/^\d{10}-\d{2}-\d{6}$/.test(x);
const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);
export function indexRecentOwnershipFilings(submissions,{limit=100}={}){
 const cik=submissions?.cik;
 if(!Number.isSafeInteger(cik)||cik<=0)throw Error('Invalid SEC submissions CIK');
 const recent=submissions?.filings?.recent;
 if(!recent||!Array.isArray(recent.accessionNumber)||!Array.isArray(recent.form)||!Array.isArray(recent.filingDate)||!Array.isArray(recent.primaryDocument))throw Error('Invalid SEC submissions recent index');
 const n=recent.accessionNumber.length;
 if([recent.form,recent.filingDate,recent.primaryDocument].some(a=>a.length!==n))throw Error('SEC submissions index column mismatch');
 if(!Number.isInteger(limit)||limit<0||limit>1000)throw Error('Invalid limit');
 const out=[],seen=new Set(),cikDigits=String(cik);
 for(let i=0;i<n&&out.length<limit;i++){
  const form=recent.form[i],accession=recent.accessionNumber[i],filingDate=recent.filingDate[i],primaryDocument=recent.primaryDocument[i];
  if(form!=='4'&&form!=='4/A')continue;
  if(!validAccession(accession)||!validDate(filingDate)||typeof primaryDocument!=='string'||!/^[\w.-]+$/.test(primaryDocument))throw Error('Malformed ownership filing index entry');
  if(seen.has(accession))throw Error('Duplicate SEC accession in recent index');
  seen.add(accession);
  const directory=accession.replaceAll('-','');
  const base='https://www.sec.gov/Archives/edgar/data/'+cikDigits+'/'+directory+'/';
  out.push({cik:cikDigits,accession,formType:form,filingDate,primaryDocument,filingIndexUrl:base,primaryDocumentUrl:base+primaryDocument,xmlStatus:'not_fetched',validationStatus:'pending'});
 }
 return out;
}
