import { describe, expect, it } from 'vitest';
import { markdownToPlainText, parseSuggestionsFromResponse } from './modalUtils';

describe('markdownToPlainText', () => {
  it('removes h1 headers', () => {
    expect(markdownToPlainText('# Header')).toBe('Header');
  });

  it('removes h2 headers', () => {
    expect(markdownToPlainText('## Header')).toBe('Header');
  });

  it('removes h3-h6 headers', () => {
    expect(markdownToPlainText('### H3')).toBe('H3');
    expect(markdownToPlainText('#### H4')).toBe('H4');
    expect(markdownToPlainText('##### H5')).toBe('H5');
    expect(markdownToPlainText('###### H6')).toBe('H6');
  });

  it('removes bold markers (**)', () => {
    expect(markdownToPlainText('**bold text**')).toBe('bold text');
  });

  it('removes italic markers (*)', () => {
    expect(markdownToPlainText('*italic text*')).toBe('italic text');
  });

  it('removes bold markers (__)', () => {
    expect(markdownToPlainText('__bold text__')).toBe('bold text');
  });

  it('removes italic markers (_)', () => {
    expect(markdownToPlainText('_italic text_')).toBe('italic text');
  });

  it('removes links but keeps text', () => {
    expect(markdownToPlainText('[click here](https://example.com)')).toBe('click here');
  });

  it('removes inline code backticks', () => {
    expect(markdownToPlainText('use `kubectl get pods`')).toBe('use kubectl get pods');
  });

  it('removes strikethrough', () => {
    expect(markdownToPlainText('~~deleted~~')).toBe('deleted');
  });

  it('collapses extra whitespace', () => {
    expect(markdownToPlainText('too   many    spaces')).toBe('too many spaces');
  });

  it('removes list markers (-)', () => {
    expect(markdownToPlainText('- list item')).toBe('list item');
  });

  it('removes list markers (*)', () => {
    expect(markdownToPlainText('* list item')).toBe('list item');
  });

  it('removes list markers (+)', () => {
    expect(markdownToPlainText('+ list item')).toBe('list item');
  });

  it('removes numbered list markers', () => {
    expect(markdownToPlainText('1. first item')).toBe('first item');
  });

  it('removes blockquote markers', () => {
    expect(markdownToPlainText('> quoted text')).toBe('quoted text');
  });

  it('removes horizontal rules', () => {
    expect(markdownToPlainText('---')).toBe('');
  });

  it('handles combined markdown', () => {
    const input = '## **Bold Header**\n- *item one*\n- `item two`';
    const result = markdownToPlainText(input);
    expect(result).toContain('Bold Header');
    expect(result).toContain('item one');
    expect(result).toContain('item two');
    expect(result).not.toContain('**');
    expect(result).not.toContain('*');
    expect(result).not.toContain('`');
    expect(result).not.toContain('##');
  });

  it('handles empty string', () => {
    expect(markdownToPlainText('')).toBe('');
  });

  it('handles plain text without markdown', () => {
    expect(markdownToPlainText('plain text')).toBe('plain text');
  });

  it('handles bold + italic (***text***)', () => {
    const result = markdownToPlainText('***bold italic***');
    expect(result).toBe('bold italic');
  });

  it('handles nested bold in italic', () => {
    const result = markdownToPlainText('*some **bold** in italic*');
    expect(result).toContain('some');
    expect(result).toContain('bold');
    expect(result).toContain('in italic');
  });
});

describe('parseSuggestionsFromResponse', () => {
  it('extracts suggestions from response', () => {
    const content = 'Here is the answer.\nSUGGESTIONS: Show pods | Check logs | Describe service';
    const result = parseSuggestionsFromResponse(content);
    expect(result.suggestions).toEqual(['Show pods', 'Check logs', 'Describe service']);
    expect(result.cleanContent).toBe('Here is the answer.');
  });

  it('removes suggestions line from clean content', () => {
    const content = 'Answer text\nSUGGESTIONS: A | B | C\nMore text';
    const result = parseSuggestionsFromResponse(content);
    expect(result.cleanContent).not.toContain('SUGGESTIONS');
    expect(result.cleanContent).toContain('Answer text');
    expect(result.cleanContent).toContain('More text');
  });

  it('limits to 3 suggestions', () => {
    const content = 'SUGGESTIONS: A | B | C | D | E';
    const result = parseSuggestionsFromResponse(content);
    expect(result.suggestions).toHaveLength(3);
  });

  it('returns empty suggestions when no SUGGESTIONS line', () => {
    const content = 'Just a regular response with no suggestions';
    const result = parseSuggestionsFromResponse(content);
    expect(result.suggestions).toEqual([]);
    expect(result.cleanContent).toBe(content);
  });

  it('handles case-insensitive SUGGESTIONS', () => {
    const content = 'suggestions: Option A | Option B';
    const result = parseSuggestionsFromResponse(content);
    expect(result.suggestions).toHaveLength(2);
  });

  it('filters empty suggestions', () => {
    const content = 'SUGGESTIONS: A | | B';
    const result = parseSuggestionsFromResponse(content);
    expect(result.suggestions).toEqual(['A', 'B']);
  });

  it('strips markdown from suggestion text', () => {
    const content = 'SUGGESTIONS: **bold option** | `code option`';
    const result = parseSuggestionsFromResponse(content);
    expect(result.suggestions).toEqual(['bold option', 'code option']);
  });

  it('handles non-string content (array)', () => {
    const content = [
      { type: 'text', text: 'Answer\nSUGGESTIONS: A | B' },
      { type: 'image', url: 'http://example.com/img.png' },
    ];
    const result = parseSuggestionsFromResponse(content);
    expect(result.suggestions).toEqual(['A', 'B']);
    expect(result.cleanContent).toContain('Answer');
  });

  it('handles non-string content (object with text)', () => {
    const content = { text: 'Answer\nSUGGESTIONS: X | Y' };
    const result = parseSuggestionsFromResponse(content);
    expect(result.suggestions).toEqual(['X', 'Y']);
  });

  it('handles null content', () => {
    const result = parseSuggestionsFromResponse(null);
    expect(result.suggestions).toEqual([]);
    expect(result.cleanContent).toBe('');
  });

  it('handles undefined content', () => {
    const result = parseSuggestionsFromResponse(undefined);
    expect(result.suggestions).toEqual([]);
    expect(result.cleanContent).toBe('');
  });

  it('handles number content', () => {
    const result = parseSuggestionsFromResponse(42);
    expect(result.suggestions).toEqual([]);
    expect(result.cleanContent).toBe('42');
  });

  it('handles empty string', () => {
    const result = parseSuggestionsFromResponse('');
    expect(result.suggestions).toEqual([]);
    expect(result.cleanContent).toBe('');
  });

  it('only captures first SUGGESTIONS line', () => {
    const content = 'SUGGESTIONS: A | B\nSUGGESTIONS: C | D';
    const result = parseSuggestionsFromResponse(content);
    expect(result.suggestions).toEqual(['A', 'B']);
  });
});
