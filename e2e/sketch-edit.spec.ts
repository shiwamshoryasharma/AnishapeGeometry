import {test,expect} from '@playwright/test'
async function sketch(page:import('@playwright/test').Page){
 await page.goto('/#projects');await page.getByRole('button',{name:'New project',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Create project',exact:true}).click();await page.getByRole('button',{name:'Create sketch',exact:true}).click();await page.getByRole('button',{name:'Sketch on XY plane',exact:true}).click()
}
test('sketch offset and rotate preserve editable geometry, undo and reload',async({page},info)=>{
 await sketch(page);await expect(page.getByRole('button',{name:'Modify sketch',exact:true})).toBeVisible({timeout:2000});await page.getByRole('button',{name:'Modify sketch',exact:true}).click()
 await page.getByLabel('Sketch modification',{exact:true}).selectOption('offset');await page.getByLabel('Modification value',{exact:true}).fill('5');await page.getByRole('button',{name:'Apply sketch modification',exact:true}).click()
 await expect(page.locator('.sketch-state')).toContainText('8 entities');await expect(page.locator('.sketch-state')).toContainText('2 regions')
 await page.getByRole('button',{name:'Undo sketch',exact:true}).click();await expect(page.locator('.sketch-state')).toContainText('4 entities');await page.getByRole('button',{name:'Redo sketch',exact:true}).click();await expect(page.locator('.sketch-state')).toContainText('8 entities')
 await page.getByRole('button',{name:'Select all sketch entities',exact:true}).click();await page.getByLabel('Sketch modification',{exact:true}).selectOption('rotate');await page.getByLabel('Modification value',{exact:true}).fill('90');await page.getByRole('button',{name:'Apply sketch modification',exact:true}).click()
 await page.getByRole('button',{name:'Fit sketch',exact:true}).click();await page.screenshot({path:info.outputPath('sketch-offset-rotate.png')})
 await page.getByRole('button',{name:'Finish sketch',exact:true}).click();await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Sketch 1',exact:true}).click();await expect(page.locator('.sketch-state')).toContainText('8 entities')
})
test('split at an edge preserves a closed region and extrudes the same solid',async({page})=>{
 await sketch(page);await expect(page.getByRole('button',{name:'Modify sketch',exact:true})).toBeVisible({timeout:2000});await page.getByRole('button',{name:'Modify sketch',exact:true}).click();await page.getByLabel('Sketch modification',{exact:true}).selectOption('split')
 await page.getByRole('button',{name:'Close modify tools',exact:true}).click()
 const canvas=page.getByRole('img',{name:'Multi-profile sketch drawing surface'})
 const at=await canvas.evaluate(el=>{const s=el as SVGSVGElement,p=new DOMPoint(Number(s.dataset.originX)+25*Number(s.dataset.scale),Number(s.dataset.originY)).matrixTransform(s.getScreenCTM()!);return {x:p.x,y:p.y}})
 await page.mouse.click(at.x,at.y);await expect(page.locator('.sketch-state')).toContainText('5 entities');await expect(page.locator('.sketch-state')).toContainText('1 regions')
 await page.getByRole('button',{name:'Finish sketch',exact:true}).click();await page.getByRole('button',{name:'Extrude',exact:true}).click();await page.getByRole('button',{name:'Apply',exact:true}).click();await expect(page.getByTestId('model-volume')).toHaveText('24000.000 mm³')
})
