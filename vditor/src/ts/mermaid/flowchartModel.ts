/** A source-mapped, deliberately bounded flowchart editor. Unknown syntax stays opaque. */
export interface SourceSpan { start: number; end: number }
export interface FlowStatement extends SourceSpan {
    text: string;
    kind: "header" | "node" | "group" | "end" | "direction" | "directive" | "opaque";
    group?: string;
    nodes: NodeOccurrence[];
    edges: FlowEdge[];
}
interface NodeOccurrence extends SourceSpan { id: string; label?: string; shape: string; classes: string }
export interface FlowNode { id: string; label: string; shape: string; group?: string; occurrences: NodeOccurrence[] }
export interface FlowEdge extends SourceSpan { id: string; from: string; to: string; label: string; type: string; statement: FlowStatement }
export interface FlowGroup extends SourceSpan { id: string; label: string; parent?: string; direction?: string; close?: SourceSpan }
export interface Flowchart {
    source: string; direction: string; header?: FlowStatement;
    nodes: FlowNode[]; edges: FlowEdge[]; groups: FlowGroup[]; statements: FlowStatement[]; issues: string[];
}
export const nodeShapes: Record<string, [string, string]> = {
    rectangle: ["[", "]"], rounded: ["(", ")"], diamond: ["{", "}"],
    stadium: ["([", "])"], circle: ["((", "))"], database: ["[(", ")]"],
    subroutine: ["[[", "]]"], hexagon: ["{{", "}}"],
    parallelogram: ["[/", "/]"], trapezoid: ["[/", "\\]"],
    inverseTrapezoid: ["[\\", "/]"], inverseParallelogram: ["[\\", "\\]"], asymmetric: [">", "]"],
};
export const edgeTypes = ["-->", "---", "-.->", "-.-", "==>", "===", "<-->", "<-.->", "<==>", "--o", "--x"];
const encode = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "#quot;").replace(/\|/g, "#124;").replace(/\r?\n/g, "<br/>");
const decode = (s: string) => s.replace(/^"([\s\S]*)"$/, "$1").replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/#quot;|#34;/g, '"').replace(/#124;/g, "|").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
const identifier = /^[A-Za-z0-9_]+(?:-(?![-.>=])[A-Za-z0-9_]+)*/;
const nodeText = (n: Pick<FlowNode, "id" | "label" | "shape">) => {
    const shape = nodeShapes[n.shape] || nodeShapes.rectangle;
    return `${n.id}${shape[0]}"${encode(n.label)}"${shape[1]}`;
};
const edgeText = (e: Pick<FlowEdge, "from" | "to" | "type" | "label">) =>
    `${e.from} ${e.type}${e.label ? `|"${encode(e.label)}"|` : ""} ${e.to}`;

/** Split only outside strings/shapes. Keep comments, front matter and init directives verbatim. */
const scan = (source: string): FlowStatement[] => {
    const result: FlowStatement[] = [];
    let start = 0, quote = false, pipe = false;
    const brackets: string[] = [];
    const push = (end: number, opaque = false) => {
        const raw = source.slice(start, end), leading = raw.length - raw.trimStart().length;
        const text = raw.trim();
        if (text) result.push({start: start + leading, end: start + leading + text.length,
            text, kind: opaque ? "opaque" : "node", nodes: [], edges: []});
    };
    if (/^---\r?\n/.test(source)) {
        const end = /^---\s*$/gm;
        end.lastIndex = 4;
        const match = end.exec(source);
        if (match) { push(match.index + match[0].length, true); start = match.index + match[0].length; }
    }
    for (let i = start; i < source.length; i++) {
        const c = source[i];
        if (!quote && !pipe && !brackets.length && source.slice(i, i + 2) === "%%") {
            push(i);
            start = i;
            let end = source.indexOf("\n", i);
            if (source.slice(i, i + 3) === "%%{") {
                const close = source.indexOf("}%%", i + 3);
                end = close < 0 ? source.length : close + 3;
            }
            if (end < 0) end = source.length;
            push(end, true); start = end; i = end - 1; continue;
        }
        if (c === '"') quote = !quote;
        if (!quote) {
            if (c === "|" && !brackets.length) pipe = !pipe;
            if (!pipe) {
                if ("[({".includes(c)) brackets.push(c);
                else if ("])}".includes(c)) brackets.pop();
            }
        }
        if (!quote && !pipe && !brackets.length && (c === "\n" || c === ";")) {
            push(i); start = i + 1;
        }
    }
    push(source.length);
    return result;
};

const readNode = (text: string, offset: number): NodeOccurrence | undefined => {
    const match = identifier.exec(text);
    if (!match) return;
    const id = match[0];
    let end = id.length, label: string | undefined, shape = "rectangle";
    const tail = text.slice(end);
    for (const key of Object.keys(nodeShapes).sort((a, b) => nodeShapes[b][0].length - nodeShapes[a][0].length)) {
        const [open, close] = nodeShapes[key];
        if (!tail.startsWith(open)) continue;
        let quote = false, closing = -1;
        for (let i = open.length; i < tail.length; i++) {
            if (tail[i] === '"') quote = !quote;
            if (!quote && tail.slice(i, i + close.length) === close) { closing = i; break; }
        }
        if (closing < 0) continue;
        label = decode(tail.slice(open.length, closing).trim());
        shape = key; end += closing + close.length; break;
    }
    const classes = /^(:::[A-Za-z0-9_-]+)/.exec(text.slice(end))?.[0] || "";
    end += classes.length;
    return {id, label, shape, classes, start: offset, end: offset + end};
};

export const parseFlowchart = (source: string): Flowchart => {
    const graph: Flowchart = {source, direction: "TD", nodes: [], edges: [], groups: [], statements: scan(source), issues: []};
    const stack: FlowGroup[] = [], nodeMap = new Map<string, FlowNode>();
    for (const s of graph.statements) {
        s.group = stack[stack.length - 1]?.id;
        if (s.kind === "opaque") continue;
        const header = /^(flowchart|graph)\s+(TD|TB|BT|LR|RL)$/.exec(s.text);
        if (header && !graph.header && !stack.length) {
            s.kind = "header"; graph.header = s; graph.direction = header[2]; continue;
        }
        if (s.text.startsWith("subgraph ")) {
            const n = readNode(s.text.slice(9).trim(), s.start + 9);
            if (!n || n.end !== s.end || graph.groups.some(g => g.id === n.id)) {
                graph.issues.push(`Unsupported subgraph: ${s.text}`); continue;
            }
            s.kind = "group";
            const group: FlowGroup = {id: n.id, label: n.label ?? n.id, start: s.start, end: s.end, parent: s.group};
            graph.groups.push(group); stack.push(group); continue;
        }
        if (s.text === "end") {
            s.kind = "end";
            const group = stack.pop();
            if (group) group.close = s; else graph.issues.push("Unmatched end");
            continue;
        }
        const direction = /^direction\s+(TD|TB|BT|LR|RL)$/.exec(s.text);
        if (direction && stack.length) {
            s.kind = "direction"; stack[stack.length - 1].direction = direction[1]; continue;
        }
        if (/^(style|classDef|class|linkStyle|click|accTitle:|accDescr:)\s*/.test(s.text)) {
            s.kind = "directive"; continue;
        }
        let cursor = 0, failed = false;
        const nextNode = () => {
            cursor += /^\s*/.exec(s.text.slice(cursor))![0].length;
            const n = readNode(s.text.slice(cursor), s.start + cursor);
            if (n) { cursor = n.end - s.start; s.nodes.push(n); }
            return n;
        };
        let previous = nextNode();
        while (previous && cursor < s.text.length) {
            cursor += /^\s*/.exec(s.text.slice(cursor))![0].length;
            if (cursor === s.text.length) break;
            const start = cursor, rest = s.text.slice(cursor);
            let type = "", label = "";
            const arrow = edgeTypes.slice().sort((a, b) => b.length - a.length).find(t => rest.startsWith(t));
            if (arrow) { type = arrow; cursor += arrow.length; }
            else {
                const labeled = /^(--|==|-\.)\s+(.+?)\s+(-->|==>|\.->)/.exec(rest);
                if (labeled) {
                    type = labeled[3] === "==>" ? "==>" : labeled[3] === ".->" ? "-.->" : "-->";
                    label = decode(labeled[2]); cursor += labeled[0].length;
                }
            }
            cursor += /^\s*/.exec(s.text.slice(cursor))![0].length;
            if (s.text[cursor] === "|") {
                let end = -1, quote = false;
                for (let i = cursor + 1; i < s.text.length; i++) {
                    if (s.text[i] === '"') quote = !quote;
                    if (s.text[i] === "|" && !quote) { end = i; break; }
                }
                if (end < 0) { failed = true; break; }
                label = decode(s.text.slice(cursor + 1, end)); cursor = end + 1;
            }
            if (!type) { failed = true; break; }
            const next = nextNode();
            if (!next) { failed = true; break; }
            const e: FlowEdge = {id: `edge-${graph.edges.length + s.edges.length}`, from: previous.id, to: next.id,
                type, label, start: s.start + start, end: next.start, statement: s};
            s.edges.push(e); previous = next;
        }
        if (failed || !previous || cursor < s.text.length) { graph.issues.push(`Unsupported statement: ${s.text}`); continue; }
        for (const n of s.nodes) {
            if (n.label && (/<(?!br\s*\/?\s*>)[^>]+>/i.test(source.slice(n.start, n.end)) || /^`[\s\S]*`$/.test(n.label))) {
                graph.issues.push(`Rich labels require source editing: ${n.id}`);
            }
            let node = nodeMap.get(n.id);
            if (!node) {
                node = {id: n.id, label: n.label ?? n.id, shape: n.shape, group: s.group, occurrences: []};
                graph.nodes.push(node); nodeMap.set(n.id, node);
            }
            if (s.group && node.group && node.group !== s.group) graph.issues.push(`Node belongs to multiple subgraphs: ${n.id}`);
            if (s.group) node.group = s.group;
            if (n.label !== undefined) { node.label = n.label; node.shape = n.shape; }
            node.occurrences.push(n);
        }
        graph.edges.push(...s.edges);
    }
    if (!graph.header) graph.issues.push("Visual editing supports flowchart / graph with a direction");
    if (stack.length) graph.issues.push("Unclosed subgraph");
    if (graph.groups.some(g => nodeMap.has(g.id))) graph.issues.push("Links to subgraphs require source editing");
    return graph;
};

interface Patch extends SourceSpan { text: string }
const patch = (source: string, edits: Patch[]) => edits.sort((a, b) => b.start - a.start)
    .reduce((text, e) => text.slice(0, e.start) + e.text + text.slice(e.end), source);
const append = (source: string, text: string) => source + (source.endsWith("\n") ? "" : "\n") + text + "\n";
const uniqueId = (graph: Flowchart, prefix: string) => {
    let i = 1;
    while ([...graph.nodes, ...graph.groups].some(n => n.id === `${prefix}${i}`)) i++;
    return `${prefix}${i}`;
};

export const updateNode = (g: Flowchart, id: string, changes: Partial<Pick<FlowNode, "label" | "shape">>): string => {
    const node = g.nodes.find(n => n.id === id)!;
    const occurrences = node.occurrences.filter(n => n.label !== undefined);
    const targets = occurrences.length ? occurrences : node.occurrences.slice(0, 1);
    return patch(g.source, targets.map(n => ({...n, text: nodeText({...node, ...changes}) + n.classes})));
};
export const updateEdge = (g: Flowchart, id: string, changes: Partial<Pick<FlowEdge, "label" | "type">>) => {
    const edge = {...g.edges.find(e => e.id === id)!, ...changes};
    return patch(g.source, [{...edge, text: `${edge.type}${edge.label ? `|"${encode(edge.label)}"|` : ""} `}]);
};
export const setDirection = (g: Flowchart, direction: string) => patch(g.source, [{...g.header!, text: `flowchart ${direction}`}]);
export const addNode = (g: Flowchart, label: string, group?: string) => {
    const id = uniqueId(g, "N"), text = nodeText({id, label, shape: "rectangle"});
    const parent = g.groups.find(p => p.id === group);
    return {id, source: parent?.close ? patch(g.source, [{start: parent.close.start, end: parent.close.start, text: `${text}\n`}]) : append(g.source, text)};
};
export const addEdge = (g: Flowchart, from: string, to: string) => append(g.source, edgeText({from, to, type: "-->", label: ""}));
export const addGroup = (g: Flowchart, label: string) => {
    const id = uniqueId(g, "G");
    return {id, source: append(g.source, `subgraph ${id}["${encode(label)}"]\nend`)};
};
export const updateGroup = (g: Flowchart, id: string, label: string) => {
    const group = g.groups.find(p => p.id === id)!;
    return patch(g.source, [{...group, text: `subgraph ${id}["${encode(label)}"]`}]);
};

const remapLinkStyles = (g: Flowchart, retained: FlowEdge[]): Patch[] => {
    const indices = new Map(retained.map((e, i) => [g.edges.indexOf(e), i]));
    return g.statements.flatMap(s => {
        const m = /^linkStyle\s+([\d,]+)\s+([\s\S]+)$/.exec(s.text);
        if (!m) return [];
        const ids = m[1].split(",").map(Number).filter(i => indices.has(i)).map(i => indices.get(i));
        return [{...s, text: ids.length ? `linkStyle ${ids.join(",")} ${m[2]}` : ""}];
    });
};
export const deleteElements = (g: Flowchart, nodeIds: string[], edgeIds: string[] = []) => {
    const retained = g.edges.filter(e => !nodeIds.includes(e.from) && !nodeIds.includes(e.to) && !edgeIds.includes(e.id));
    const edits: Patch[] = remapLinkStyles(g, retained);
    for (const s of g.statements) {
        if (s.kind === "node" && (s.nodes.some(n => nodeIds.includes(n.id)) || s.edges.some(e => !retained.includes(e)))) {
            const nodes = s.nodes.filter(n => !nodeIds.includes(n.id));
            edits.push({...s, text: [...nodes.map(n => g.source.slice(n.start, n.end)),
                ...s.edges.filter(e => retained.includes(e)).map(edgeText)].join("\n")});
        }
        const m = /^(style|class|click)\s+([^\s]+)\s+([\s\S]+)$/.exec(s.text);
        if (m && m[2].split(",").some(id => nodeIds.includes(id))) {
            const ids = m[2].split(",").filter(id => !nodeIds.includes(id));
            edits.push({...s, text: ids.length ? `${m[1]} ${ids.join(",")} ${m[3]}` : ""});
        }
    }
    return patch(g.source, edits);
};

/** Membership changes reorganise structural statements; opaque text and style directives survive. */
export const regroup = (g: Flowchart, memberships: Map<string, string | undefined>, deletedGroup?: string) => {
    const deleted = g.groups.find(p => p.id === deletedGroup);
    const groups = g.groups.filter(p => p.id !== deletedGroup).map(p => ({...p, parent: p.parent === deletedGroup ? deleted?.parent : p.parent}));
    const nodes = g.nodes.map(n => ({...n, group: memberships.has(n.id) ? memberships.get(n.id) : n.group === deletedGroup ? deleted?.parent : n.group}));
    const lines: string[] = [];
    const emit = (parent?: string, indent = "") => {
        for (const node of nodes.filter(n => n.group === parent)) {
            const classes = [...new Set(node.occurrences.map(o => o.classes.slice(3)).filter(Boolean))].join(",");
            lines.push(indent + nodeText(node));
            if (classes) lines.push(`${indent}class ${node.id} ${classes}`);
        }
        for (const group of groups.filter(p => p.parent === parent)) {
            lines.push(`${indent}subgraph ${group.id}["${encode(group.label)}"]`);
            if (group.direction) lines.push(`${indent}  direction ${group.direction}`);
            emit(group.id, indent + "  "); lines.push(indent + "end");
        }
    };
    emit(); lines.push(...g.edges.map(edgeText));
    const structure = g.statements.filter(s => ["node", "group", "end", "direction"].includes(s.kind));
    const edits: Patch[] = structure.map(s => ({...s, text: ""}));
    edits.push({start: g.header!.end, end: g.header!.end, text: "\n" + lines.join("\n")});
    if (deletedGroup) {
        for (const s of g.statements) {
            const m = /^(style|class|click)\s+([^\s]+)\s+([\s\S]+)$/.exec(s.text);
            if (m && m[2].split(",").includes(deletedGroup)) {
                const ids = m[2].split(",").filter(id => id !== deletedGroup);
                edits.push({...s, text: ids.length ? `${m[1]} ${ids.join(",")} ${m[3]}` : ""});
            }
        }
    }
    return patch(g.source, edits);
};

export const readStyle = (g: Flowchart, id: string, edge = false): Record<string, string> => {
    const result: Record<string, string> = {};
    const merge = (text: string) => text.split(/,(?![^()]*\))/).forEach(pair => {
        const colon = pair.indexOf(":");
        if (colon >= 0) result[pair.slice(0, colon).trim()] = pair.slice(colon + 1).trim();
    });
    const classes = new Set(["default"]);
    if (!edge) {
        g.nodes.find(n => n.id === id)?.occurrences.forEach(n => { if (n.classes) classes.add(n.classes.slice(3)); });
        for (const s of g.statements) {
            const m = /^class\s+([^\s]+)\s+([^\s]+)$/.exec(s.text);
            if (m && m[1].split(",").includes(id)) m[2].split(",").forEach(c => classes.add(c));
        }
        for (const s of g.statements) {
            const m = /^classDef\s+([^\s]+)\s+([\s\S]+)$/.exec(s.text);
            if (m && m[1].split(",").some(c => classes.has(c))) merge(m[2]);
        }
    }
    for (const s of g.statements) {
        const m = (edge ? /^linkStyle\s+([^\s]+)\s+([\s\S]+)$/ : /^style\s+([^\s]+)\s+([\s\S]+)$/).exec(s.text);
        if (m && (m[1].split(",").includes(id) || edge && m[1] === "default")) merge(m[2]);
    }
    return result;
};
export const setStyle = (g: Flowchart, id: string, styles: Record<string, string>, edge = false) => {
    const prefix = `${edge ? "linkStyle" : "style"} ${id} `;
    const existing = g.statements.filter(s => s.text.startsWith(prefix)).pop();
    const text = prefix + Object.entries({...readStyle(g, id, edge), ...styles}).map(([k, v]) => `${k}:${v}`).join(",");
    return existing ? patch(g.source, [{...existing, text}]) : append(g.source, text);
};

export const selectionAt = (g: Flowchart, position: number): {kind: "node" | "edge" | "group"; id: string} | undefined => {
    for (const n of g.nodes) if (n.occurrences.some(o => position >= o.start && position <= o.end)) return {kind: "node", id: n.id};
    for (const e of g.edges) if (position >= e.start && position <= e.end) return {kind: "edge", id: e.id};
    for (const p of g.groups) if (position >= p.start && position <= p.end) return {kind: "group", id: p.id};
};
