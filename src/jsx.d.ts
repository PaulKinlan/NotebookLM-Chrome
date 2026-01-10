import { h, Fragment } from './jsx-runtime';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: {
        className?: string;
        [attr: string]: any;
      };
    }

    type Element = Node;
    interface ElementChildrenAttribute {
      children: {};
    }
  }
}

export { h, Fragment };
