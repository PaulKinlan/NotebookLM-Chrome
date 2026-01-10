type Child = Node | string | number | boolean | null | undefined;

function isNode(x: unknown): x is Node {
  return typeof Node !== "undefined" && x instanceof Node;
}

function append(el: Element | DocumentFragment, child: Child): void {
  if (child === null || child === undefined || child === false || child === true) return;

  if (Array.isArray(child)) {
    // Shouldn't happen with our type, but safe
    for (const c of child as unknown as Child[]) append(el, c);
    return;
  }

  if (isNode(child)) {
    el.appendChild(child);
    return;
  }

  el.appendChild(document.createTextNode(String(child)));
}

export function Fragment(props: { children?: Child | Child[] }): DocumentFragment {
  const frag = document.createDocumentFragment();
  const children = props.children;

  if (Array.isArray(children)) {
    for (const c of children) append(frag, c);
  } else {
    append(frag, children);
  }

  return frag;
}

export function h(
  tag: string | ((props: any) => Node),
  props: Record<string, any> | null,
  ...children: Child[]
): Node {
  if (typeof tag === "function") {
    return tag({ ...(props ?? {}), children });
  }

  const el = document.createElement(tag);

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (key === "className") {
        el.setAttribute("class", String(value));
      } else if (key.startsWith("on") && typeof value === "function") {
        // onClick -> click
        const event = key.slice(2).toLowerCase();
        el.addEventListener(event, value as EventListener);
      } else if (value === true) {
        el.setAttribute(key, "");
      } else if (value !== false && value != null) {
        el.setAttribute(key, String(value));
      }
    }
  }

  for (const c of children) append(el, c);

  return el;
}
