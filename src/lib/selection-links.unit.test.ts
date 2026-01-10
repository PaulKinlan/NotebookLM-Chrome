/**
 * Unit tests for selection-links module
 *
 * Tests the getLinksInSelection function which extracts HTTP/HTTPS links
 * from a text selection in the DOM.
 *
 * Note: This test file uses innerHTML to create test fixtures. This is safe
 * because all HTML content is hardcoded test data, not user input.
 *
 * @vitest-environment jsdom
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getLinksInSelection } from './selection-links.ts';

describe('getLinksInSelection', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    // Create a container for our test DOM
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Clean up the DOM
    document.body.removeChild(container);
    // Clear any selection
    window.getSelection()?.removeAllRanges();
  });

  /**
   * Helper function to select a range of content
   */
  function selectContent(startNode: Node, startOffset: number, endNode: Node, endOffset: number): void {
    const selection = window.getSelection();
    if (!selection) return;

    selection.removeAllRanges();
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    selection.addRange(range);
  }

  /**
   * Helper function to select all content within an element
   */
  function selectAll(element: HTMLElement): void {
    const selection = window.getSelection();
    if (!selection) return;

    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.addRange(range);
  }

  /**
   * Helper to safely create test DOM structure
   * Uses innerHTML for test fixtures - safe because content is hardcoded, not user input
   */
  function setTestHTML(html: string): void {
    container.innerHTML = html;
  }

  it('returns empty array when there is no selection', () => {
    const result = getLinksInSelection();
    expect(result).toEqual([]);
  });

  it('returns empty array when selection has no links', () => {
    setTestHTML('<p>Just some plain text without any links.</p>');
    const p = container.querySelector('p')!;
    selectAll(p);

    const result = getLinksInSelection();
    expect(result).toEqual([]);
  });

  it('extracts a single link from selection', () => {
    setTestHTML('<p>Check out <a href="https://example.com">this link</a> for more info.</p>');
    const p = container.querySelector('p')!;
    selectAll(p);

    const result = getLinksInSelection();
    expect(result).toContain('https://example.com/');
    expect(result).toHaveLength(1);
  });

  it('extracts multiple links from selection', () => {
    setTestHTML(`
      <p>
        Visit <a href="https://example.com">Example</a> and
        <a href="https://google.com">Google</a> for more.
      </p>
    `);
    const p = container.querySelector('p')!;
    selectAll(p);

    const result = getLinksInSelection();
    expect(result).toHaveLength(2);
    expect(result).toContain('https://example.com/');
    expect(result).toContain('https://google.com/');
  });

  it('returns unique links when same URL appears multiple times', () => {
    setTestHTML(`
      <p>
        <a href="https://example.com">First link</a> and
        <a href="https://example.com">same link again</a>.
      </p>
    `);
    const p = container.querySelector('p')!;
    selectAll(p);

    const result = getLinksInSelection();
    expect(result).toHaveLength(1);
    expect(result).toContain('https://example.com/');
  });

  it('only extracts HTTP and HTTPS links', () => {
    setTestHTML(`
      <p>
        <a href="https://secure.com">HTTPS</a>,
        <a href="http://insecure.com">HTTP</a>,
        <a href="mailto:test@example.com">Email</a>,
        <a href="javascript:void(0)">JS</a>,
        <a href="ftp://files.com">FTP</a>.
      </p>
    `);
    const p = container.querySelector('p')!;
    selectAll(p);

    const result = getLinksInSelection();
    expect(result).toHaveLength(2);
    expect(result).toContain('https://secure.com/');
    expect(result).toContain('http://insecure.com/');
    expect(result).not.toContain('mailto:test@example.com');
    expect(result).not.toContain('javascript:void(0)');
    expect(result).not.toContain('ftp://files.com/');
  });

  it('extracts link when selection is entirely within an anchor', () => {
    setTestHTML('<p><a href="https://example.com">This is a long link text that you might select partially</a></p>');
    const anchor = container.querySelector('a')!;
    const textNode = anchor.firstChild!;

    // Select just part of the link text
    selectContent(textNode, 5, textNode, 15);

    const result = getLinksInSelection();
    expect(result).toHaveLength(1);
    expect(result).toContain('https://example.com/');
  });

  it('extracts nested links within complex DOM structures', () => {
    setTestHTML(`
      <div>
        <p>Some text before</p>
        <ul>
          <li><a href="https://link1.com">Link 1</a></li>
          <li><a href="https://link2.com">Link 2</a></li>
        </ul>
        <p>Some text after</p>
      </div>
    `);
    const div = container.querySelector('div')!;
    selectAll(div);

    const result = getLinksInSelection();
    expect(result).toHaveLength(2);
    expect(result).toContain('https://link1.com/');
    expect(result).toContain('https://link2.com/');
  });

  it('handles links with various URL formats', () => {
    setTestHTML(`
      <p>
        <a href="https://example.com/path/to/page">With path</a>,
        <a href="https://example.com?query=value">With query</a>,
        <a href="https://example.com#section">With hash</a>,
        <a href="https://sub.example.com">Subdomain</a>.
      </p>
    `);
    const p = container.querySelector('p')!;
    selectAll(p);

    const result = getLinksInSelection();
    expect(result).toHaveLength(4);
    expect(result).toContain('https://example.com/path/to/page');
    expect(result).toContain('https://example.com/?query=value');
    expect(result).toContain('https://example.com/#section');
    expect(result).toContain('https://sub.example.com/');
  });

  it('ignores anchors without href attribute', () => {
    setTestHTML(`
      <p>
        <a href="https://example.com">Valid link</a> and
        <a name="bookmark">Named anchor</a> and
        <a>Empty anchor</a>.
      </p>
    `);
    const p = container.querySelector('p')!;
    selectAll(p);

    const result = getLinksInSelection();
    expect(result).toHaveLength(1);
    expect(result).toContain('https://example.com/');
  });

  it('handles selection spanning multiple elements', () => {
    setTestHTML(`
      <div id="start">Start text <a href="https://first.com">first link</a></div>
      <div>Middle text <a href="https://middle.com">middle link</a></div>
      <div id="end"><a href="https://last.com">last link</a> end text</div>
    `);

    const startDiv = container.querySelector('#start')!;
    const endDiv = container.querySelector('#end')!;

    // Select from start of first div to end of last div
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    const range = document.createRange();
    range.setStart(startDiv, 0);
    range.setEnd(endDiv, endDiv.childNodes.length);
    selection.addRange(range);

    const result = getLinksInSelection();
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});
