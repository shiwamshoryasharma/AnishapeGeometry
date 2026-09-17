import {test,expect} from '@playwright/test'
test('CAD dropdown and command search surfaces follow both themes, including focus and disabled items',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#projects');await page.getByRole('button',{name:'New project',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Create project',exact:true}).click();
 for(const theme of ['dark','light']){
  if(await page.locator('html').getAttribute('data-theme')!==theme)await page.getByRole('button',{name:'Switch to '+theme+' mode',exact:true}).click();
  for(const label of ['Create','Modify','Pattern','Construct']){
   await page.getByRole('button',{name:label,exact:true}).click();const menu=page.getByRole('menu');await expect(menu).toBeVisible();
   expect(await menu.evaluate(e=>{const s=getComputedStyle(e),probe=document.createElement('div');probe.style.backgroundColor='var(--raised)';document.body.append(probe);const expected=getComputedStyle(probe).backgroundColor;probe.remove();return s.backgroundColor===expected})).toBe(true);
   const ratios=await menu.getByRole('menuitem').evaluateAll(items=>{const lum=(s:string)=>s.match(/[\d.]+/g)!.slice(0,3).map(Number).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((a,n,i)=>a+n*[.2126,.7152,.0722][i],0);return items.map(e=>{const s=getComputedStyle(e),bg=s.backgroundColor==='rgba(0, 0, 0, 0)'?getComputedStyle(e.parentElement!).backgroundColor:s.backgroundColor;const a=lum(s.color),b=lum(bg);return {label:e.textContent,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),opacity:s.opacity}})});
   for(const r of ratios){expect(r.ratio,label+' '+theme+' '+r.label).toBeGreaterThanOrEqual(4.5);expect(r.opacity).toBe('1')}
   if(label==='Pattern')await page.screenshot({path:info.outputPath('pattern-menu-'+theme+'.png')});await page.keyboard.press('Escape');
  }
  await page.getByRole('button',{name:'Search commands Ctrl K',exact:true}).click();await page.getByLabel('Search commands',{exact:true}).fill('pattern');await expect(page.locator('.command-search-results span').first()).toHaveCSS('color',theme==='dark'?'rgb(180, 195, 213)':'rgb(75, 91, 112)');await page.keyboard.press('Escape');
 }
})
