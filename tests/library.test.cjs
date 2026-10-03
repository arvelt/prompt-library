const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {randomUUID}=require('node:crypto');
const source=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function app(){
  const node={style:{},dataset:{},setAttribute(){},addEventListener(){}};
  const context={crypto:{randomUUID},navigator:{language:'ja',clipboard:{writeText:async text=>{context.copied=text;}}},localStorage:{getItem(){return null;}},document:{querySelector(){return node;},querySelectorAll(){return [];},addEventListener(){}},window:{addEventListener(){}},structuredClone,FormData,TextDecoder,setTimeout(){},clearTimeout(){}};
  vm.createContext(context);
  vm.runInContext(source.replace('  init();','  globalThis.api={seed,validateData,parseBlockTags,registerBlockTags,itemsHTML,copyText,finalPrompt,setState(value){state=value;}};'),context);
  return context;
}
test('metadata survives legacy and current JSON, with blank display-name fallback',()=>{
  const {api}=app(),state=api.seed(),tag=state.library.positive[0].subcategories[0].items[0];
  tag.name='上から';tag.description='俯瞰の構図';
  const clean=api.validateData(JSON.parse(JSON.stringify(state)));
  assert.equal(clean.library.positive[0].subcategories[0].items[0].description,'俯瞰の構図');
  tag.name='';assert.equal(api.validateData(state).library.positive[0].subcategories[0].items[0].name,'');
  const legacy=api.validateData({version:1,library:state.library,prompts:state.promptSets[0].prompts});
  assert.equal(legacy.library.positive[0].subcategories[0].items[0].description,'俯瞰の構図');
  tag.description=123;assert.throws(()=>api.validateData(state));
});
test('block registration adds missing tags once, reuses tags across categories and sides stay independent',()=>{
  const {api}=app(),state=api.seed();api.setState(state);
  const sub=state.library.positive[0].subcategories[0],before=sub.items.length;
  const block={text:'angry,\nfrown,\nfurrowed brow,\nangry, smile,',tagIds:[]};
  api.registerBlockTags(block,sub);
  assert.equal(sub.items.length,before+3);assert.equal(block.tagIds.length,4);
  assert.equal(sub.items.find(i=>i.text==='angry').name,'');
  api.registerBlockTags(block,sub);assert.equal(sub.items.length,before+3);
  const negative=state.library.negative[0].subcategories[0];
  api.registerBlockTags({text:'angry'},negative,'negative');
  assert.notEqual(negative.items.find(i=>i.text==='angry').id,sub.items.find(i=>i.text==='angry').id);
  assert.deepEqual(Array.from(api.parseBlockTags('(red, blue:1.2), [a,b], <lora:test:1>, escaped\\,comma,')),['(red, blue:1.2)','[a,b]','<lora:test:1>','escaped\\,comma']);
});
test('copy preserves the literal snippet and does not modify library or prompts',async()=>{
  const context=app(),{api}=context,state=api.seed();api.setState(state);
  const before=JSON.stringify(state),snippet='angry,\nfrown, furrowed brow,\n';
  await api.copyText(snippet,'Copied','Manual copy');
  assert.equal(context.copied,snippet);assert.equal(JSON.stringify(state),before);
});
test('tag cards show escaped metadata and block copy has a separate action',()=>{
  const {api}=app(),state=api.seed();api.setState(state);
  const html=api.itemsHTML([{id:'tag',name:'微笑む',text:'smile',description:'<script>用途</script>'}],true,'tag');
  assert.ok(html.includes('微笑む'));assert.ok(html.includes('smile'));assert.ok(html.includes('&lt;script&gt;用途&lt;/script&gt;'));
  assert.ok(api.itemsHTML([{id:'block',name:'表情',text:'angry,'}],true,'block').includes('data-copy-block="block"'));
});
