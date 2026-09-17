import type { CadDocument, Unit } from './types'
import { validateFeature } from './features'
export interface Quantity {value:number;length:number;angle:number}
const scalar=(value:number):Quantity=>({value,length:0,angle:0})
const units:Record<string,Quantity>={mm:{value:1,length:1,angle:0},cm:{value:10,length:1,angle:0},m:{value:1000,length:1,angle:0},um:{value:.001,length:1,angle:0},in:{value:25.4,length:1,angle:0},ft:{value:304.8,length:1,angle:0},deg:{value:Math.PI/180,length:0,angle:1},rad:{value:1,length:0,angle:1}}
const compatible=(a:Quantity,b:Quantity)=>{if(a.length!==b.length||a.angle!==b.angle)throw Error('Incompatible expression units or dimensions.')}
export function evaluateExpression(source:string,parameters:Record<string,Quantity>={},lookup?:(name:string)=>Quantity):Quantity {
 if(source.length>500)throw Error('Expression is too long.')
 const tokens=source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[A-Za-z][A-Za-z0-9_]*|[()+\-*/,]|\S/gi)??[]
 let index=0,depth=0
 const multiply=(a:Quantity,b:Quantity,divide=false):Quantity=>({value:divide?a.value/b.value:a.value*b.value,length:a.length+(divide?-b.length:b.length),angle:a.angle+(divide?-b.angle:b.angle)})
 const primary=():Quantity=>{
  if(++depth>40)throw Error('Expression is too deeply nested.')
  const token=tokens[index++];let result:Quantity
  if(token==='+'||token==='-'){result=primary();if(token==='-')result={...result,value:-result.value}}
  else if(token==='('){result=sum();if(tokens[index++]!==')')throw Error('Missing closing parenthesis.')}
  else if(token&&/^(?:\d|\.)/.test(token)){const n=Number(token);if(!Number.isFinite(n))throw Error('Invalid number.');result=scalar(n);if(Object.hasOwn(units,tokens[index]))result=multiply(result,units[tokens[index++]])}
  else if(token&&/^[A-Za-z][A-Za-z0-9_]*$/.test(token)){
   if(tokens[index]==='('){index++;const args=[sum()];while(tokens[index]===','){index++;args.push(sum())}if(tokens[index++]!==')')throw Error('Missing function parenthesis.');const a=args[0]
    if(['sin','cos','tan'].includes(token)){if(args.length!==1||a.length!==0||a.angle!==1)throw Error('Trigonometric functions require an angle, e.g. 30 deg.');result=scalar(token==='sin'?Math.sin(a.value):token==='cos'?Math.cos(a.value):Math.tan(a.value))}
    else if(token==='sqrt'){if(args.length!==1||a.value<0)throw Error('Invalid square root.');result={value:Math.sqrt(a.value),length:a.length/2,angle:a.angle/2}}
    else if(token==='abs'){if(args.length!==1)throw Error('abs needs one argument.');result={...a,value:Math.abs(a.value)}}
    else if(token==='min'||token==='max'){args.forEach(v=>compatible(v,a));result={...a,value:token==='min'?Math.min(...args.map(v=>v.value)):Math.max(...args.map(v=>v.value))}}
    else throw Error('Unknown function: '+token)
   }else result=token==='pi'?scalar(Math.PI):(Object.hasOwn(units,token)?units[token]:undefined)??(Object.hasOwn(parameters,token)?parameters[token]:undefined)??lookup?.(token)??(()=>{throw Error('Unknown parameter: '+token)})()
  }else throw Error('Invalid expression token: '+String(token))
  depth--;return result
 }
 const product=():Quantity=>{let result=primary();while(tokens[index]==='*'||tokens[index]==='/'){const op=tokens[index++];result=multiply(result,primary(),op==='/')}return result}
 const sum=():Quantity=>{let result=product();while(tokens[index]==='+'||tokens[index]==='-'){const op=tokens[index++],b=product();compatible(result,b);result={...result,value:result.value+(op==='+'?b.value:-b.value)}}return result}
 const result=sum();if(index!==tokens.length||!Number.isFinite(result.value))throw Error('Invalid or non-finite expression result.');return result
}
export function resolveParameters(definitions:Record<string,string>):Record<string,Quantity>{
 const result:Record<string,Quantity>=Object.create(null),visiting=new Set<string>()
 const lookup=(name:string):Quantity=>{if(result[name])return result[name];if(!Object.hasOwn(definitions,name))throw Error('Unknown parameter: '+name);if(visiting.has(name))throw Error('Parameter dependency cycle: '+name);visiting.add(name);const value=evaluateExpression(definitions[name],result,lookup);visiting.delete(name);return result[name]=value}
 for(const name of Object.keys(definitions)){if(Object.hasOwn(units,name)||name==='pi')throw Error('Reserved parameter name: '+name);lookup(name)}return result
}
export function resolveDocumentParameters(doc:CadDocument):void{
 const parameters=resolveParameters(doc.parameters??{})
 for(const feature of doc.features){for(const [key,expression]of Object.entries(feature.expressions??{})){
  const result=evaluateExpression(expression,parameters),isAngle=['angle','pressureAngle','sinkAngle'].includes(key),isScalar=['count','teeth','factor'].includes(key)
  if(isScalar?(result.length!==0||result.angle!==0):isAngle?(result.length!==0||![0,1].includes(result.angle)):(result.angle!==0||![0,1].includes(result.length)))throw Error('Incompatible units for '+key)
  const value=isAngle&&result.angle===1?result.value*180/Math.PI:result.value
  ;(feature.parameters as unknown as Record<string,number>)[key]=value
 }validateFeature(feature)}
}

/** A scalar entered in a length field keeps the entry unit when document units change. */
export function lengthBinding(text:string,parameters:Record<string,Quantity>,unit:Unit):string {
 return evaluateExpression(text,parameters).length===0?'('+text+') * 1 '+unit:text
}
