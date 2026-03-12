import { describe, expect, it, vi } from 'vitest';

vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  Link: vi.fn(),
}));

vi.mock('@kinvolk/headlamp-plugin/lib/k8s', () => ({
  ResourceClasses: {},
}));

vi.mock('react-router-dom', () => ({
  Link: vi.fn(),
  useHistory: () => ({ push: vi.fn() }),
}));

vi.mock('react-markdown', () => ({
  default: vi.fn(),
}));

vi.mock('remark-gfm', () => ({
  default: vi.fn(),
}));

vi.mock('./components', () => ({
  LogsButton: vi.fn(),
  YamlDisplay: vi.fn(),
}));

vi.mock('./utils/promptLinkHelper', () => ({
  getHeadlampLink: vi.fn(),
}));

vi.mock('./utils/SampleYamlLibrary', () => ({
  parseKubernetesYAML: vi.fn(),
}));

import {
  convertJsonToYaml,
  isJsonKubernetesResource,
  parseJsonContent,
  parseLogsButtonData,
} from './ContentRenderer';

describe('parseLogsButtonData', () => {
  it('parses valid logs button JSON', () => {
    const content = 'LOGS_BUTTON:{"data":{"logs":"line1\\nline2"}}';
    const result = parseLogsButtonData(content, 0);
    expect(result.success).toBe(true);
    expect(result.data.data.logs).toBe('line1\nline2');
  });

  it('finds JSON after LOGS_BUTTON: prefix', () => {
    const content = 'Some text LOGS_BUTTON:{"data":{"logs":"test"}}';
    const result = parseLogsButtonData(content, content.indexOf('LOGS_BUTTON:'));
    expect(result.success).toBe(true);
  });

  it('handles nested JSON objects', () => {
    const content = 'LOGS_BUTTON:{"data":{"logs":"test","metadata":{"pod":"my-pod"}}}';
    const result = parseLogsButtonData(content, 0);
    expect(result.success).toBe(true);
    expect(result.data.data.metadata.pod).toBe('my-pod');
  });

  it('handles braces inside JSON string values', () => {
    const content = 'LOGS_BUTTON:{"data":{"logs":"error: {unexpected}"}}';
    const result = parseLogsButtonData(content, 0);
    expect(result.success).toBe(true);
    expect(result.data.data.logs).toBe('error: {unexpected}');
  });

  it('handles escaped quotes inside JSON strings', () => {
    const content = 'LOGS_BUTTON:{"data":{"logs":"say \\"hello\\""}}';
    const result = parseLogsButtonData(content, 0);
    expect(result.success).toBe(true);
    expect(result.data.data.logs).toBe('say "hello"');
  });

  it('handles backslashes in JSON strings', () => {
    const content = 'LOGS_BUTTON:{"data":{"logs":"path\\\\to\\\\file"}}';
    const result = parseLogsButtonData(content, 0);
    expect(result.success).toBe(true);
    expect(result.data.data.logs).toBe('path\\to\\file');
  });

  it('fails when no JSON object found', () => {
    const content = 'LOGS_BUTTON: no json here';
    const result = parseLogsButtonData(content, 0);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No JSON object found');
  });

  it('fails when required fields are missing', () => {
    const content = 'LOGS_BUTTON:{"other":"field"}';
    const result = parseLogsButtonData(content, 0);
    expect(result.success).toBe(false);
    expect(result.error).toContain('missing required fields');
  });

  it('fails when data.logs is missing', () => {
    const content = 'LOGS_BUTTON:{"data":{"other":"field"}}';
    const result = parseLogsButtonData(content, 0);
    expect(result.success).toBe(false);
    expect(result.error).toContain('missing required fields');
  });

  it('handles JSON with extra text after it', () => {
    const content = 'LOGS_BUTTON:{"data":{"logs":"test"}} and some more text';
    const result = parseLogsButtonData(content, 0);
    expect(result.success).toBe(true);
    expect(result.data.data.logs).toBe('test');
  });

  it('handles complex nested structures with braces in strings', () => {
    const content =
      'LOGS_BUTTON:{"data":{"logs":"Error in container {nginx}: exit code {1}","pod":"test"}}';
    const result = parseLogsButtonData(content, 0);
    expect(result.success).toBe(true);
    expect(result.data.data.logs).toBe('Error in container {nginx}: exit code {1}');
  });
});

describe('parseJsonContent', () => {
  it('parses valid JSON', () => {
    const result = parseJsonContent('{"key": "value"}');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ key: 'value' });
  });

  it('parses JSON arrays', () => {
    const result = parseJsonContent('[1, 2, 3]');
    expect(result.success).toBe(true);
    expect(result.data).toEqual([1, 2, 3]);
  });

  it('fails on invalid JSON', () => {
    const result = parseJsonContent('not json');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid JSON');
  });

  it('fails on empty string', () => {
    const result = parseJsonContent('');
    expect(result.success).toBe(false);
  });
});

describe('isJsonKubernetesResource', () => {
  it('identifies K8s resource JSON', () => {
    const json = JSON.stringify({
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'test' },
    });
    expect(isJsonKubernetesResource(json)).toBe(true);
  });

  it('rejects JSON without apiVersion', () => {
    const json = JSON.stringify({
      kind: 'Pod',
      metadata: { name: 'test' },
    });
    expect(isJsonKubernetesResource(json)).toBe(false);
  });

  it('rejects JSON without kind', () => {
    const json = JSON.stringify({
      apiVersion: 'v1',
      metadata: { name: 'test' },
    });
    expect(isJsonKubernetesResource(json)).toBe(false);
  });

  it('rejects non-JSON strings', () => {
    expect(isJsonKubernetesResource('not json')).toBe(false);
  });

  it('rejects strings not starting with {', () => {
    expect(isJsonKubernetesResource('[1, 2, 3]')).toBe(false);
  });

  it('handles whitespace around JSON', () => {
    const json = '  {"apiVersion": "v1", "kind": "Pod", "metadata": {"name": "test"}}  ';
    expect(isJsonKubernetesResource(json)).toBe(true);
  });
});

describe('convertJsonToYaml', () => {
  it('converts K8s JSON to YAML', () => {
    const json = JSON.stringify({
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'test' },
    });
    const result = convertJsonToYaml(json);
    expect(result).toContain('apiVersion: v1');
    expect(result).toContain('kind: Pod');
    expect(result).toContain('name: test');
  });

  it('returns original content for non-K8s JSON', () => {
    const json = '{"key": "value"}';
    expect(convertJsonToYaml(json)).toBe(json);
  });

  it('returns original content for non-JSON', () => {
    const text = 'not json content';
    expect(convertJsonToYaml(text)).toBe(text);
  });

  it('returns original content for JSON arrays', () => {
    const json = '[1, 2, 3]';
    expect(convertJsonToYaml(json)).toBe(json);
  });
});
