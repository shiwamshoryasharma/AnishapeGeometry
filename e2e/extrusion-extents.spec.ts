import {test,expect,type Page} from '@playwright/test'
async function start(page:Page){
 await page.goto('/#projects');await page.getByRole('button',{name:'New project',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Create project',exact:true}).click();await page.getByRole('button',{name:'Create sketch',exact:true}).click();await page.getByRole('button',{name:'Sketch on XY plane',exact:true}).click();await page.getByRole('button',{name:'Finish sketch',exact:true}).click();await page.getByRole('button',{name:'Extrude',exact:true}).click()
}
test('two-sided extrusion retains independent depths and start offset across edit and reload',async({page})=>{
 await start(page);await expect(page.getByLabel('Extrusion extent',{exact:true})).toBeVisible({timeout:2000});await page.getByLabel('Extrusion extent',{exact:true}).selectOption('two-sided')
 await page.getByLabel('Distance',{exact:true}).fill('5');await page.getByLabel('Second depth',{exact:true}).fill('7');await page.getByLabel('Start offset',{exact:true}).fill('3')
 await page.getByRole('button',{name:'Preview geometry',exact:true}).click();await expect(page.getByText('FEATURE PREVIEW',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Apply',exact:true}).click();await expect(page.getByTestId('model-volume')).toHaveText('18000.000 mm³')
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Extrude 1',exact:true}).click()
 await expect(page.getByLabel('Extrusion extent',{exact:true})).toHaveValue('two-sided');await expect(page.getByLabel('Second depth',{exact:true})).toHaveValue('7');await expect(page.getByLabel('Start offset',{exact:true})).toHaveValue('3')
 await page.getByLabel('Second depth',{exact:true}).fill('9');await page.getByRole('button',{name:'Apply',exact:true}).click();await expect(page.getByTestId('model-volume')).toHaveText('21000.000 mm³')
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByTestId('model-volume')).toHaveText('18000.000 mm³');await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(page.getByTestId('model-volume')).toHaveText('21000.000 mm³')
})
test('through-all cut tracks target depth and up-to-face uses a real selected face',async({page})=>{
 await start(page);await page.getByRole('button',{name:'Apply',exact:true}).click();await expect(page.getByTestId('model-volume')).toHaveText('24000.000 mm³')
 await page.getByRole('button',{name:'TOP',exact:true}).click()
 const viewport=page.getByLabel('3D model viewport. Drag to orbit, right-drag to pan, scroll to zoom.',{exact:true});await viewport.click({position:{x:(await viewport.boundingBox())!.width/2,y:(await viewport.boundingBox())!.height/2}})
 await page.getByRole('button',{name:'Extrude',exact:true}).click();await page.getByLabel('Extrusion extent',{exact:true}).selectOption('up-to-face');await page.getByRole('button',{name:'Use selected limit face',exact:true}).click()
 await page.getByRole('button',{name:'Apply',exact:true}).click();await expect(page.getByTestId('model-volume')).toHaveText('48000.000 mm³')
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByTestId('model-volume')).toHaveText('24000.000 mm³')
 await viewport.click({position:{x:(await viewport.boundingBox())!.width/2,y:(await viewport.boundingBox())!.height/2}});await page.getByRole('button',{name:'Sketch on face',exact:true}).click();await page.getByRole('toolbar',{name:'Sketch tools'}).getByRole('button',{name:'Circle',exact:true}).click()
 await page.getByLabel('Origin X',{exact:true}).fill('25');await page.getByLabel('Origin Y',{exact:true}).fill('15');await page.getByLabel('Diameter',{exact:true}).fill('10');await page.getByRole('button',{name:'Finish sketch',exact:true}).click()
 await page.getByRole('button',{name:'Extrude',exact:true}).click();await page.getByLabel('Extrude operation',{exact:true}).selectOption('cut');await page.getByLabel('Extrusion direction',{exact:true}).selectOption('forward');await page.getByLabel('Distance',{exact:true}).fill('-16');await page.getByLabel('Extrusion extent',{exact:true}).selectOption('through-all');await expect(page.getByLabel('Extrusion direction',{exact:true})).toHaveValue('reverse',{timeout:2000});await page.getByRole('button',{name:'Apply',exact:true}).click();await expect(page.getByTestId('model-volume')).toHaveText('22743.363 mm³')
 await page.getByRole('button',{name:'Extrude 1',exact:true}).click();await page.getByLabel('Distance',{exact:true}).fill('30');await page.getByRole('button',{name:'Apply',exact:true}).click();await expect(page.getByTestId('model-volume')).toHaveText('42643.806 mm³')
})
