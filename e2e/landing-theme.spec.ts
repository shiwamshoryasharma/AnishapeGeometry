import {test,expect} from '@playwright/test'
test('landing illustrations, floating card, chips and local-data section stay readable in both themes',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
 for(const theme of ['dark','light']){
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.getByRole('button',{name:'Switch to '+theme+' mode',exact:true}).click();
  const result=await page.evaluate(()=>{const lum=(s:string)=>s.match(/[\d.]+/g)!.slice(0,3).map(Number).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((a,n,i)=>a+n*[.2126,.7152,.0722][i],0);return ['.floating-spec strong','.floating-spec small','.mini-chip','.validation-tag','.local-node strong','.local-node small','.local-copy .inline-link','.precision-number>span','.precision-visual>span','.formats-list>div>span:nth-child(2)','.model-caption','.step-heading>span','.site-footer>span','.sketch-art text','.solid-art text'].map(selector=>{const e=document.querySelector(selector)!;let p:Element|null=e,bg='';while(p){bg=getComputedStyle(p).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent')break;p=p.parentElement}const s=getComputedStyle(e),a=lum(e.tagName==='text'?s.fill:s.color),b=lum(bg);return {selector,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)}})});
  for(const r of result)expect(r.ratio,theme+' '+r.selector).toBeGreaterThanOrEqual(4.5);
  for(const selector of ['.workflow-art','.floating-spec','.mini-chip','.validation-tag'])expect(await page.locator(selector).first().evaluate(e=>getComputedStyle(e).backgroundColor)).not.toBe(theme==='dark'?'rgb(252, 253, 248)':'rgb(27, 37, 49)');
  await page.screenshot({path:info.outputPath('landing-'+theme+'.png'),fullPage:true});
 }
})
