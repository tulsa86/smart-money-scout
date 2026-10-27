// Strict, dependency-free XML tree reader for SEC ownership documents.
// Rejects malformed XML rather than silently extracting partial transactions.
const decode=s=>s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,e)=>{
 if(e[0]==='#'){const n=e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):parseInt(e.slice(1),10);if(n<0||n>0x10ffff||n>=0xd800&&n<=0xdfff)throw Error('Invalid XML character');return String.fromCodePoint(n)}
 return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[e.toLowerCase()]
});
export function parseOwnershipXml(xml){
 if(typeof xml!=='string'||xml.length>5_000_000)throw Error('Invalid XML size');
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('XML DTD and entities forbidden');
 const root={name:'#document',children:[],text:''},stack=[root];
 const tokens=xml.match(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<[^>]*>|[^<]+/g)||[];
 if(tokens.join('')!==xml)throw Error('Malformed XML');
 for(const token of tokens){
  if(token.startsWith('<!--')||token.startsWith('<?'))continue;
  if(token.startsWith('<![CDATA[')){stack.at(-1).text+=token.slice(9,-3);continue}
  if(token.startsWith('</')){
   const m=token.match(/^<\/([\w.:-]+)\s*>$/);if(!m||stack.length<2||stack.at(-1).name!==m[1].split(':').at(-1))throw Error('XML closing tag mismatch');
   stack.pop();continue;
  }
  if(token.startsWith('<')){
   const m=token.match(/^<([\w.:-]+)(?:\s[^<>]*?)?\s*\/?>$/);if(!m)throw Error('Malformed XML tag');
   const node={name:m[1].split(':').at(-1),children:[],text:''};stack.at(-1).children.push(node);
   if(!token.endsWith('/>'))stack.push(node);
  }else stack.at(-1).text+=decode(token);
 }
 if(stack.length!==1||root.children.length!==1||root.children[0].name!=='ownershipDocument')throw Error('Invalid ownership document XML');
 return root.children[0];
}
export const children=(node,name)=>node?.children?.filter(n=>n.name===name)??[];
export const first=(node,name)=>children(node,name)[0];
export const val=(node,name)=>{const n=first(node,name);if(!n)return null;const v=first(n,'value')??n;return v.text.trim()||null};
