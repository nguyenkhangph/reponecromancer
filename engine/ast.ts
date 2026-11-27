import { parse } from "@babel/parser";
import type { File } from "@babel/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyNode = any;

export function parseJs(code: string): File | null {
  try {
    return parse(code, {
      sourceType: "unambiguous",
      allowReturnOutsideFunction: true,
      errorRecovery: true,
      plugins: ["jsx"],
    });
  } catch {
    return null;
  }
}

/** Depth-first walk with parent pointers. Visitor may return false to skip children. */
export function walk(
  node: AnyNode,
  visit: (node: AnyNode, parent: AnyNode | null, key: string | null) => void | false,
  parent: AnyNode | null = null,
  key: string | null = null,
): void {
  if (!node || typeof node.type !== "string") return;
  if (visit(node, parent, key) === false) return;
  for (const k of Object.keys(node)) {
    if (k === "loc" || k === "start" || k === "end" || k === "leadingComments" || k === "trailingComments" || k === "innerComments" || k === "extra") continue;
    const child = (node as any)[k];
    if (Array.isArray(child)) {
      for (const c of child) if (c && typeof c.type === "string") walk(c, visit, node, k);
    } else if (child && typeof child.type === "string") {
      walk(child, visit, node, k);
    }
  }
}

/** Returns the module name if node is `require('x')`. */
export function requireTarget(node: AnyNode | null | undefined): string | null {
  if (!node || node.type !== "CallExpression") return null;
  if (node.callee.type !== "Identifier" || node.callee.name !== "require") return null;
  const a = node.arguments[0];
  if (a && a.type === "StringLiteral") return a.value;
  return null;
}

export interface Bindings {
  /** local identifier -> module name, e.g. uuid -> node-uuid */
  modules: Map<string, string>;
  /** identifiers holding an express() application */
  expressApps: Set<string>;
  /** declarator nodes for require bindings, by local name */
  declarators: Map<string, { declaration: AnyNode; declarator: AnyNode }>;
}

export function collectBindings(ast: AnyNode): Bindings {
  const modules = new Map<string, string>();
  const expressApps = new Set<string>();
  const declarators = new Map<string, { declaration: AnyNode; declarator: AnyNode }>();
  const pendingApps: Array<{ name: string; callee: string }> = [];

  walk(ast, (node, parent) => {
    if (node.type === "VariableDeclarator" && node.id.type === "Identifier" && node.init) {
      const mod = requireTarget(node.init);
      if (mod) {
        modules.set(node.id.name, mod);
        if (parent && parent.type === "VariableDeclaration") {
          declarators.set(node.id.name, { declaration: parent, declarator: node });
        }
      } else if (node.init.type === "CallExpression" && node.init.callee.type === "Identifier") {
        pendingApps.push({ name: node.id.name, callee: node.init.callee.name });
      } else if (
        node.init.type === "CallExpression" &&
        requireTarget(node.init.callee) === "express"
      ) {
        expressApps.add(node.id.name);
      }
    }
  });
  for (const p of pendingApps) {
    if (modules.get(p.callee) === "express") expressApps.add(p.name);
  }
  return { modules, expressApps, declarators };
}

export function lineOf(code: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < code.length; i++) if (code.charCodeAt(i) === 10) line++;
  return line;
}

export function lineText(code: string, index: number): string {
  const start = code.lastIndexOf("\n", index - 1) + 1;
  let end = code.indexOf("\n", index);
  if (end === -1) end = code.length;
  return code.slice(start, end).trim();
}

/** Root identifier of a member/call chain: $('a').find('b').bind -> "$" */
export function chainRoot(node: AnyNode | null | undefined): string | null {
  let cur: AnyNode | null | undefined = node;
  while (cur) {
    if (cur.type === "Identifier") return cur.name;
    if (cur.type === "ThisExpression") return "this";
    if (cur.type === "MemberExpression" || cur.type === "OptionalMemberExpression") cur = cur.object;
    else if (cur.type === "CallExpression" || cur.type === "OptionalCallExpression") cur = cur.callee;
    else return null;
  }
  return null;
}

export function propName(member: AnyNode): string | null {
  if (member.type !== "MemberExpression" && member.type !== "OptionalMemberExpression") return null;
  if (!member.computed && member.property.type === "Identifier") return member.property.name;
  if (member.computed && member.property.type === "StringLiteral") return member.property.value;
  return null;
}
