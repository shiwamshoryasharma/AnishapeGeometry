export function downloadFile(data:BlobPart,name:string,type:string){
  const url=URL.createObjectURL(new Blob([data],{type}))
  const a=document.createElement('a');a.href=url;a.download=name.replace(/[<>:"/\\|?*]/g,'_').split('').map(c=>c.charCodeAt(0)<32?'_':c).join('').slice(0,140);a.click()
  setTimeout(()=>URL.revokeObjectURL(url),30000)
}
