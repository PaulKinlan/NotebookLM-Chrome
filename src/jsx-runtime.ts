type Child = Node | string | number | boolean | null | undefined;

function isNode(x: unknown): x is Node {
  return typeof Node !== "undefined" && x instanceof Node;
}

function append(el: Element | DocumentFragment, child: Child): void {
  if (child === null || child === undefined || child === false || child === true) return;

  if (Array.isArray(child)) {
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

/**
 * jsx is for elements with static children (known at compile time)
 * Children are passed in props
 */
export function jsx(
  tag: string | ((props: Record<string, unknown>) => Node),
  props: Record<string, unknown> & { key?: string | number | null },
  _key?: string | number | null
): Node {
  if (typeof tag === "function") {
    return tag(props);
  }

  const el = document.createElement(tag);

  if (props) {
    for (const [propKey, value] of Object.entries(props)) {
      if (propKey === "className") {
        el.setAttribute("class", String(value));
      } else if (propKey.startsWith("on") && typeof value === "function") {
        // onClick -> click
        const event = propKey.slice(2).toLowerCase();
        el.addEventListener(event, value as EventListener);
      } else if (value === true) {
        el.setAttribute(propKey, "");
      } else if (
        propKey === "style" &&
        value !== null &&
        value !== undefined &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const style = (el as HTMLElement).style;
        for (const [styleName, styleValue] of Object.entries(
          value as Record<string, unknown>
        )) {
          if (styleValue === null || styleValue === undefined || styleValue === false) {
            continue;
          }
          style.setProperty(styleName, String(styleValue));
        }
      } else if (value !== false && value !== null && propKey !== "children") {
        el.setAttribute(propKey, String(value));
      }
    }

    // Handle children from props
    if ("children" in props) {
      const children = props.children as Child | Child[];
      if (Array.isArray(children)) {
        for (const c of children) append(el, c);
      } else {
        append(el, children);
      }
    }
  }

  return el;
}

/**
 * jsxs is for elements with multiple/dynamic children (arrays)
 * Children are passed in props
 * Same implementation as jsx - kept separate for React compatibility
 */
export function jsxs(
  tag: string | ((props: Record<string, unknown>) => Node),
  props: Record<string, unknown> & { key?: string | number | null },
  key?: string | number | null
): Node {
  return jsx(tag, props, key);
}
