/** Strict small batch RFC4180 reader; handles BOM, CRLF, quoted commas/newlines and escaped quotes. */
export function parseCsv(text:string,maxRows=1000):string[][]{
 const result:string[][]=[];let row:string[]=[];let field='',quoted=false;const input=text.replace(/^\uFEFF/,'');
 for(let i=0;i<input.length;i++){const ch=input[i];
  if(quoted){if(ch==='"'){if(input[i+1]==='"'){field+='"';i++}else quoted=false}else field+=ch}
  else if(ch==='"'&&field==='')quoted=true;
  else if(ch===','){row.push(field);field=''}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&input[i+1]==='\n')i++;row.push(field);field='';if(row.some(x=>x.trim()))result.push(row);row=[];if(result.length>maxRows+1)throw new Error('CSV exceeds the maximum batch size of '+maxRows+' rows. Split the file into smaller parts.');}
  else field+=ch;
 }
 if(quoted)throw new Error('CSV contains an unclosed quote.');row.push(field);if(row.some(x=>x.trim()))result.push(row);
 return result;
}
export function csvEscape(value:unknown){const s=String(value??'');const safe=/^[=+\-@\t\r]/.test(s)?'\''+s:s;return '"'+safe.replace(/"/g,'""')+'"'}
export function toCsv(header:string[],rows:(string|number|null|undefined)[][]){return [header,...rows].map(r=>r.map(csvEscape).join(',')).join('\r\n')+'\r\n'}
export const uploadHeaders=['sku','title','description','price','quantity','sport','team','player','year','set','card number','condition','category','image url','back image url','weight oz','inventory location'];
