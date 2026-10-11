export const TOPICS = ['Getting started', 'Websites', 'Apps', 'AI & agents', 'Design', 'Tools', 'Other'];
export const uuid = () => crypto.randomUUID();
export const assetIds = doc => [...new Set([doc?.cover, ...(doc?.steps || []).flatMap(s => (s.images || []).map(i => i.id))].filter(Boolean))];
export function failure(message, status = 400) { return Object.assign(new Error(message), {status}); }
const text = (value, max, name) => {
  if (typeof value !== 'string' || value.length > max) throw failure(`${name} must be text under ${max} characters.`);
  return value.trim();
};
export function normalizeContent(input, publishing = false) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.steps) || input.steps.length < 1 || input.steps.length > 32) throw failure('Use between 1 and 32 steps.');
  const doc = {title: text(input.title, 100, 'Title'), summary: text(input.summary, 300, 'Summary'), topic: input.topic, cover: input.cover || null, steps: []};
  if (!TOPICS.includes(doc.topic)) throw failure('Choose a guide topic.');
  if (doc.cover && !/^[a-f0-9-]{36}$/.test(doc.cover)) throw failure('Choose an uploaded cover.');
  const ids = new Set();
  for (const step of input.steps) {
    if (!step || typeof step !== 'object') throw failure('Each step must be an object.');
    if (!/^[a-f0-9-]{36}$/.test(step.id) || ids.has(step.id)) throw failure('Each step needs its own stable ID.');
    ids.add(step.id);
    if (!Number.isInteger(step.level) || step.level < 1 || step.level > 17) throw failure('Difficulty must be 1–17.');
    if (!Array.isArray(step.images) || step.images.length > 8) throw failure('Use up to eight images per step.');
    const images = step.images.map(image => {
      if (!image || typeof image !== 'object') throw failure('Choose an uploaded image.');
      if (!/^[a-f0-9-]{36}$/.test(image.id)) throw failure('Use an uploaded image.');
      return {id: image.id, alt: text(image.alt || '', 240, 'Image description')};
    });
    const item = {id: step.id, title: text(step.title, 100, 'Step title'), level: step.level, text: text(step.text, 12000, 'Step text'), prompt: text(step.prompt || '', 12000, 'Prompt'), images};
    if (publishing && (!item.title || (!item.text && !item.prompt))) throw failure('Give every step a title and instructions or a prompt.');
    doc.steps.push(item);
  }
  if (publishing && (!doc.title || doc.title === 'Untitled guide' || !doc.summary)) throw failure('Add a descriptive title and summary before publishing.');
  if (new TextEncoder().encode(JSON.stringify(doc)).length > 150000) throw failure('This guide is too large. Keep it under 150 KB of text.');
  return doc;
}
export function blankGuide() {
  return {title: 'Untitled guide', summary: '', topic: TOPICS[0], cover: null, steps: [{id: uuid(), title: '', level: 1, text: '', prompt: '', images: []}]};
}
export async function readBounded(request, limit) {
  if (Number(request.headers.get('content-length')) > limit) throw failure('Upload is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw failure('A request body is required.');
  let size = 0; const chunks = [];
  try {
    for (;;) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.byteLength; if (size > limit) throw failure('Upload is too large.', 413);
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(size); let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength; }
  return bytes;
}
export function imageType(bytes) {
  const invalid=()=>{throw failure('Choose a valid PNG, JPEG or WebP image.');};
  if(bytes.length<24)invalid();
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const ascii=(start,end)=>new TextDecoder().decode(bytes.subarray(start,end));
  let mime,width,height;
  if([137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)){
    if(bytes.length<45||ascii(12,16)!=='IHDR'||view.getUint32(8)!==13)invalid();
    mime='image/png';width=view.getUint32(16);height=view.getUint32(20);
  }else if(bytes[0]===255&&bytes[1]===216){
    mime='image/jpeg';let at=2;
    while(at+4<bytes.length){
      if(bytes[at++]!==255)continue;
      while(bytes[at]===255)at++;
      const marker=bytes[at++];if(marker===0xd9||marker===0xda)break;
      if(marker===1||(marker>=0xd0&&marker<=0xd7))continue;
      if(at+2>bytes.length)invalid();const length=view.getUint16(at);
      if(length<2||at+length>bytes.length)invalid();
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
        if(length<8)invalid();height=view.getUint16(at+3);width=view.getUint16(at+5);break;
      }at+=length;
    }
  }else if(ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP'){
    mime='image/webp';if(view.getUint32(4,true)+8>bytes.length)invalid();
    const kind=ascii(12,16);
    if(kind==='VP8X'&&bytes.length>=30){width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16);}
    else if(kind==='VP8L'&&bytes.length>=25&&bytes[20]===0x2f){const bits=view.getUint32(21,true);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;}
    else if(kind==='VP8 '&&bytes.length>=30&&bytes[23]===0x9d&&bytes[24]===1&&bytes[25]===0x2a){width=view.getUint16(26,true)&0x3fff;height=view.getUint16(28,true)&0x3fff;}
  }
  if(!mime||!width||!height)invalid();
  if(width>8192||height>8192||width*height>24000000)throw failure('Resize the image to at most 8192 pixels per side and 24 megapixels.');
  return mime;
}
