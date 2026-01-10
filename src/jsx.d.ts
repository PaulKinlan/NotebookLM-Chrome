import { h, Fragment } from './jsx-runtime';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: {
        className?: string;
        [attr: string]: unknown;
      };
    }

    type Element = Node;
    interface ElementChildrenAttribute {
      children: unknown;
    }
  }
}

export { h, Fragment };
