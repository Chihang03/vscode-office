export type DiagramFormat = 'xml' | 'svg' | 'png';
export const EMPTY_DIAGRAM = '<mxfile><diagram id="page-1" name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';
export function isDiagramPath(name: string) { return /(?:\.(?:drawio|dio)|\.drawio\.(?:svg|png))$/i.test(name); }
export function diagramFormat(name: string): DiagramFormat {
    if (/\.drawio\.png$/i.test(name)) return 'png';
    if (/\.drawio\.svg$/i.test(name)) return 'svg';
    return 'xml';
}
export function sameBytes(a: Uint8Array, b: Uint8Array) { return a.length === b.length && a.every((value, index) => value === b[index]); }
export function decodeDataUri(value: string, mime: string): Uint8Array {
    const prefix = `data:${mime};base64,`;
    if (typeof value !== 'string' || !value.startsWith(prefix) || value.length > 48 * 1024 * 1024) throw new Error('Invalid diagram export');
    const binary = atob(value.slice(prefix.length));
    return Uint8Array.from(binary, c => c.charCodeAt(0));
}
export function validateText(content: string, format: DiagramFormat) {
    if (typeof content !== 'string' || content.length > 16 * 1024 * 1024) throw new Error('Diagram content is invalid or too large');
    const withoutDeclaration = content.replace(/^\uFEFF/, '').replace(/^\s*<\?xml[^?]*\?>/, '').trim();
    if (format === 'svg' ? !/^<svg\b/.test(withoutDeclaration) || !/\bcontent\s*=/.test(withoutDeclaration) : !/^<(?:mxfile|mxGraphModel)\b/.test(withoutDeclaration)) throw new Error('The editor returned an invalid diagram');
}
export function validatePng(bytes: Uint8Array) {
    if (bytes.length > 32 * 1024 * 1024 || bytes.length < 20 || ![137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value)) throw new Error('Invalid PNG diagram');
    // Editable PNGs carry an mxfile/mxGraphModel text chunk, not only rendered pixels.
    if (!new TextDecoder('latin1').decode(bytes).includes('mxfile')) throw new Error('PNG has no embedded diagram data');
}
