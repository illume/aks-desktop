import { describe, expect, it } from 'vitest';
import {
  BASE_AKS_AGENT_PROMPT,
  SELF_REVIEW_PROMPT,
  buildEnrichedPrompt,
  buildSelfReviewPrompt,
  hasUnfencedCode,
  shellEscapeSingleQuote,
} from './aksAgentManager';

describe('shellEscapeSingleQuote', () => {
  it('wraps simple strings in single quotes', () => {
    expect(shellEscapeSingleQuote('hello world')).toBe("'hello world'");
  });

  it('escapes single quotes', () => {
    expect(shellEscapeSingleQuote("it's")).toBe("'it'\\''s'");
  });

  it('handles empty string', () => {
    expect(shellEscapeSingleQuote('')).toBe("''");
  });

  it('prevents command substitution via $()', () => {
    const input = '$(rm -rf /)';
    const escaped = shellEscapeSingleQuote(input);
    // The $(…) is safely inside single quotes so bash won't interpret it
    expect(escaped).toBe("'$(rm -rf /)'");
    // The result must start and end with single quotes
    expect(escaped.startsWith("'")).toBe(true);
    expect(escaped.endsWith("'")).toBe(true);
  });

  it('prevents backtick command substitution', () => {
    const input = '`whoami`';
    const escaped = shellEscapeSingleQuote(input);
    expect(escaped).toBe("'`whoami`'");
  });

  it('prevents variable expansion', () => {
    const input = '$HOME/secret';
    const escaped = shellEscapeSingleQuote(input);
    expect(escaped).toBe("'$HOME/secret'");
  });

  it('handles double quotes without special treatment', () => {
    const input = 'say "hello"';
    const escaped = shellEscapeSingleQuote(input);
    expect(escaped).toBe('\'say "hello"\'');
  });

  it('handles multiple single quotes', () => {
    const input = "it's a 'test'";
    const escaped = shellEscapeSingleQuote(input);
    expect(escaped).toBe("'it'\\''s a '\\''test'\\'''");
  });

  it('handles newlines and special characters', () => {
    const input = 'line1\nline2\ttab';
    const escaped = shellEscapeSingleQuote(input);
    expect(escaped).toBe("'line1\nline2\ttab'");
  });
});

describe('buildEnrichedPrompt', () => {
  it('includes the base prompt and question', () => {
    const result = buildEnrichedPrompt('What pods are running?', []);
    expect(result).toContain(BASE_AKS_AGENT_PROMPT);
    expect(result).toContain('What pods are running?');
    expect(result).toContain('Now answer the following new question:');
  });

  it('does not include conversation history when empty', () => {
    const result = buildEnrichedPrompt('test?', []);
    expect(result).not.toContain('CONVERSATION HISTORY');
  });

  it('includes conversation history when provided', () => {
    const history = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi there!' },
    ];
    const result = buildEnrichedPrompt('Follow up', history);
    expect(result).toContain('CONVERSATION HISTORY');
    expect(result).toContain('User: Hello');
    expect(result).toContain('Assistant: Hi there!');
    expect(result).toContain('Follow up');
  });

  it('preserves conversation order', () => {
    const history = [
      { role: 'user' as const, content: 'First question' },
      { role: 'assistant' as const, content: 'First answer' },
      { role: 'user' as const, content: 'Second question' },
      { role: 'assistant' as const, content: 'Second answer' },
    ];
    const result = buildEnrichedPrompt('Third question', history);
    const firstIdx = result.indexOf('First question');
    const secondIdx = result.indexOf('Second question');
    const thirdIdx = result.indexOf('Third question');
    expect(firstIdx).toBeLessThan(secondIdx);
    expect(secondIdx).toBeLessThan(thirdIdx);
  });
});

describe('hasUnfencedCode', () => {
  it('returns false for plain prose with no code', () => {
    expect(hasUnfencedCode('Here is a description of Kubernetes pods.')).toBe(false);
  });

  it('returns false when all code is inside fenced blocks', () => {
    const text = [
      'Run this command:',
      '```bash',
      'kubectl get pods',
      '```',
    ].join('\n');
    expect(hasUnfencedCode(text)).toBe(false);
  });

  it('detects kubectl outside code blocks', () => {
    expect(hasUnfencedCode('Run kubectl get pods to see pods.')).toBe(true);
  });

  it('detects docker outside code blocks', () => {
    expect(hasUnfencedCode('Use docker build -t myapp .')).toBe(true);
  });

  it('detects helm outside code blocks', () => {
    expect(hasUnfencedCode('Run helm install my-release stable/nginx')).toBe(true);
  });

  it('detects az CLI outside code blocks', () => {
    expect(hasUnfencedCode('Run az aks get-credentials to configure kubectl')).toBe(true);
  });

  it('detects terraform outside code blocks', () => {
    expect(hasUnfencedCode('Run terraform apply to deploy')).toBe(true);
  });

  it('detects bare YAML keys (apiVersion)', () => {
    const text = 'The resource looks like:\napiVersion: v1\nkind: Pod';
    expect(hasUnfencedCode(text)).toBe(true);
  });

  it('detects bare Dockerfile directives', () => {
    const text = 'Your Dockerfile should start with:\nFROM node:18\nRUN npm install';
    expect(hasUnfencedCode(text)).toBe(true);
  });

  it('detects Python imports outside code blocks', () => {
    const text = 'You need:\nimport os\nfrom flask import Flask';
    expect(hasUnfencedCode(text)).toBe(true);
  });

  it('detects shell prompt ($) outside code blocks', () => {
    expect(hasUnfencedCode('Run:\n$ echo hello')).toBe(true);
  });

  it('detects shebang outside code blocks', () => {
    expect(hasUnfencedCode('Create script:\n#!/bin/bash\necho done')).toBe(true);
  });

  it('detects export statements outside code blocks', () => {
    expect(hasUnfencedCode('Set the variable:\nexport KUBECONFIG=~/.kube/config')).toBe(true);
  });

  it('ignores code patterns that are inside fenced blocks', () => {
    const text = [
      'Apply this:',
      '```yaml',
      'apiVersion: v1',
      'kind: Pod',
      '```',
      '',
      'That will create a pod.',
    ].join('\n');
    expect(hasUnfencedCode(text)).toBe(false);
  });

  it('detects code when some is fenced and some is not', () => {
    const text = [
      '```yaml',
      'apiVersion: v1',
      '```',
      '',
      'Also run kubectl get pods to check.',
    ].join('\n');
    expect(hasUnfencedCode(text)).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(hasUnfencedCode('')).toBe(false);
  });

  it('returns false for text mentioning tools in prose without command syntax', () => {
    // 'kubectl' at end of sentence — no following subcommand
    expect(hasUnfencedCode('Learn about kubectl.')).toBe(false);
  });
});

describe('buildSelfReviewPrompt', () => {
  it('includes the original answer in the prompt', () => {
    const answer = 'Here is a deployment:\napiVersion: apps/v1';
    const prompt = buildSelfReviewPrompt(answer);
    expect(prompt).toContain(answer);
    expect(prompt).toContain('---BEGIN RESPONSE---');
    expect(prompt).toContain('---END RESPONSE---');
  });

  it('includes formatting check instructions', () => {
    const prompt = buildSelfReviewPrompt('some answer');
    expect(prompt).toContain('fenced markdown code blocks');
    expect(prompt).toContain('LGTM');
    expect(prompt).toContain('COMPLETE corrected response');
  });

  it('matches the SELF_REVIEW_PROMPT template structure', () => {
    const prompt = buildSelfReviewPrompt('test');
    // The prompt should be the template with {RESPONSE} replaced
    const expected = SELF_REVIEW_PROMPT.replace('{RESPONSE}', 'test');
    expect(prompt).toBe(expected);
  });
});

describe('SELF_REVIEW_PROMPT', () => {
  it('contains the {RESPONSE} placeholder', () => {
    expect(SELF_REVIEW_PROMPT).toContain('{RESPONSE}');
  });

  it('instructs LGTM for well-formatted responses', () => {
    expect(SELF_REVIEW_PROMPT).toContain('LGTM');
  });

  it('asks for complete corrected response when issues found', () => {
    expect(SELF_REVIEW_PROMPT).toContain('COMPLETE corrected response');
  });

  it('checks for code block formatting', () => {
    expect(SELF_REVIEW_PROMPT).toContain('fenced markdown code blocks');
  });
});
