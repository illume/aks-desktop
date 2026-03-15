/**
 * findbugs-all.test.ts — Consolidated test file for extractAIAnswer edge cases.
 * Replaces findbugs.test.ts through findbugs15.test.ts using shared fixtures.
 */
import { describe, expect, it } from 'vitest';
import { _testing } from './aksAgentManager';

import {
  extractCodeBlocks,
  fb1_twoFileHeadings,
  fb1_dotEnvHeading,
  fb1_deepPathHeading,
  fb1_fourWordProse,
  fb1_fiveWordProse,
  fb1_yamlPipeLiteral,
  fb1_bareYaml2Lines,
  fb1_bareYaml3Lines,
  fb1_dockerfileContinuation,
  fb1_dockerCompose,
  fb1_portNumber,
  fb1_ansi256Color,
  fb1_goInterface,
  fb1_twoYamlBlocks,
  fb1_shellBacktick,
  fb1_makefileTab,
  fb1_yamlFoldedScalar,
  fb1_indentedCodeAfterList,
  fb1_requirementsTxt,
  fb1_bareCodeThenYaml,
  fb1_hyphenatedFilename,
  fb1_ansiSplitLine,
  fb1_windowsPaths,
  fb1_longPanelLine,
  fb1_dockerfileProd,
  fb1_yamlFlowMapping,
  fb1_kubectlTabular,
  fb1_panelTripleBacktick,
  fb1_tsconfigJson,
  fb1_flagsNotProse,
  fb2_nonK8sYamlProse,
  fb2_gitignoreHeading,
  fb2_dockerignoreHeading,
  fb2_yamlDocSeparator,
  fb2_shellHeredoc,
  fb2_orderedListPanels,
  fb2_unicodeFilename,
  fb2_exact78Chars,
  fb2_bareNonK8sYaml,
  fb2_nonK8sYamlSeparator,
  fb2_nestedAnsiReset,
  fb2_cargoLockToml,
  fb2_proseNotHeading,
  fb2_markdownHeadingAfterCode,
  fb2_pythonFString,
  fb2_makefileTabChars,
  fb2_deeplyNestedYaml,
  fb2_headingBlankLinePanel,
  fb2_closingBrace,
  fb2_consecutiveBlanks,
  fb2_readmeMdContent,
  fb2_ansiBoldPanel,
  fb2_twoApiVersionBlocks,
  fb2_doubleSlashPath,
  fb2_panelDashList,
  fb2_pythonImport,
  fb2_proseWordColon,
  fb2_spacesInPath,
  fb2_literalEscapeText,
  fb2_yamlKeySplit,
  fb3_heredocQuotedDelim,
  fb3_bareYamlList,
  fb3_numberedListPanels,
  fb3_makefilePhony,
  fb3_teeHeredoc,
  fb3_cssPanel,
  fb3_sqlPanel,
  fb3_proseBetweenPanels,
  fb3_bareJsonArray,
  fb3_multipleHeredocs,
  fb4_heredocDashEof,
  fb4_yamlMergeKey,
  fb4_makefilePhonyDeps,
  fb4_lowercaseSql,
  fb4_dockerfileImageTag,
  fb5_cIncludeHeaders,
  fb5_rustMatchArms,
  fb5_shellBackslashContinuation,
  fb5_tsInterface,
  fb5_jsonObject,
  fb5_pythonTripleQuoteYaml,
  fb5_goStructJsonTags,
  fb5_kubectlGetPods,
  fb5_proseWithPanelCode,
  fb5_yamlBooleanValues,
  fb5_shellCaseStatement,
  fb5_terraformHcl,
  fb5_dockerComposeYaml,
  fb5_rustLifetimes,
  fb5_numberedStepsShell,
  fb6_javaTryCatchFinally,
  fb6_printLogStatements,
  fb6_arrowFunctions,
  fb6_tsInterfaceColonMembers,
  fb6_shellUntilLoop,
  fb6_proseBetweenCodeBlocks,
  fb6_pythonFStringBraces,
  fb6_yamlAnchorsAliases,
  fb6_rustEnumDerive,
  fb6_shellIfElifElse,
  fb6_goGoroutineChannel,
  fb6_dockerRunBackslash,
  fb6_javaAnnotationsClass,
  fb6_kubectlPatchJson,
  fb6_yamlShellProseSeparated,
  fb7_luaLocalFunction,
  fb7_exportEnvVars,
  fb7_awkSedCommands,
  fb7_cssRules,
  fb7_protobufMessage,
  fb7_systemdUnitFile,
  fb7_shellPipeChain,
  fb7_shellScriptVarsCommands,
  fb7_jsonConfigObject,
  fb7_rubyClassMethods,
  fb7_kotlinDataClass,
  fb7_cStructTypedef,
  fb7_azCliJmesPath,
  fb7_pythonAsyncTypeHints,
  fb7_numberedStepsCodeBlocks,
  fb8_goStructLiteral,
  fb8_pythonKwargs,
  fb8_shellTrapSource,
  fb8_githubActionsYaml,
  fb8_rustClosuresIterators,
  fb8_shellHeredocYaml,
  fb8_dockerComposeBuildContext,
  fb8_shellFunctionDef,
  fb8_pythonNestedExpressions,
  fb8_terraformMultipleResources,
  fb8_sqlJoinQuery,
  fb8_k8sCrdDefinition,
  fb8_swiftStructProperties,
  fb8_makefileIfeq,
  fb8_elixirModule,
  fb9_tsGenericTypes,
  fb9_phpClassNamespace,
  fb9_scalaCaseClass,
  fb9_shellArraysParamExpansion,
  fb9_iniConfigFile,
  fb9_rustTurbofish,
  fb9_pythonMultiLineString,
  fb9_javaSpringBootService,
  fb9_shellHereString,
  fb9_curlJsonBody,
  fb9_kotlinSuspendFunction,
  fb9_terraformLocalsData,
  fb9_markdownTable,
  fb9_shellProcessSubstitution,
  fb9_requirementsTxt,
} from './findbugFixtures';

const { extractAIAnswer } = _testing;

function assertNoAnsiLeaks(result: string): void {
  expect(result).not.toMatch(/\x1b/);
  expect(result).not.toMatch(/\[\d+m/);
  expect(result).not.toMatch(/\[0m/);
}

describe('findbugs: all extractAIAnswer edge cases', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // Round 1
  // ═══════════════════════════════════════════════════════════════════════════
  describe('round 1', () => {
    it('1. two file headings with no blank line between panels', () => {
      const result = extractAIAnswer(fb1_twoFileHeadings);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(2);
      expect(blocks[0]).toContain('[package]');
      expect(blocks[1]).toContain('fn main()');
    });

    it('2. file heading with extension-only name .env', () => {
      const result = extractAIAnswer(fb1_dotEnvHeading);
      assertNoAnsiLeaks(result);

      expect(result).toContain('.env');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const envBlock = blocks.find(b => b.includes('DB_HOST'));
      expect(envBlock).toBeDefined();
      expect(envBlock!).toMatch(/^ /m);
    });

    it('3. file heading with deep path src/handlers/auth.rs', () => {
      const result = extractAIAnswer(fb1_deepPathHeading);
      assertNoAnsiLeaks(result);

      expect(result).toContain('src/handlers/auth.rs');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('authenticate');
    });

    it('4. prose with 4 words should NOT break file-header block', () => {
      const result = extractAIAnswer(fb1_fourWordProse);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('apiVersion');
      expect(blocks[0]).toContain('data:');
    });

    it('5. prose with 5 words SHOULD break file-header block', () => {
      const result = extractAIAnswer(fb1_fiveWordProse);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('apiVersion');
      expect(blocks[0]).not.toContain('data:');
    });

    it('6. YAML annotation with pipe literal block scalar', () => {
      const result = extractAIAnswer(fb1_yamlPipeLiteral);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const yamlBlock = blocks.find(b => b.includes('apiVersion'));
      expect(yamlBlock).toBeDefined();
      expect(yamlBlock!).toContain('more_set_headers');
      expect(yamlBlock!).toContain('spec:');
    });

    it('7. bare YAML with 2 lines should NOT be wrapped', () => {
      const result = extractAIAnswer(fb1_bareYaml2Lines);
      assertNoAnsiLeaks(result);

      expect(result).not.toMatch(/```yaml/);
      expect(result).toContain('name: myapp');
    });

    it('8. bare YAML with 3 lines SHOULD be wrapped', () => {
      const result = extractAIAnswer(fb1_bareYaml3Lines);
      assertNoAnsiLeaks(result);

      expect(result).toMatch(/```yaml/);
      const blocks = extractCodeBlocks(result);
      const yamlBlock = blocks.find(b => b.includes('name: myapp'));
      expect(yamlBlock).toBeDefined();
      expect(yamlBlock!).toContain('description');
    });

    it('9. Dockerfile heading with deeply indented continuation lines', () => {
      const result = extractAIAnswer(fb1_dockerfileContinuation);
      assertNoAnsiLeaks(result);

      expect(result).toContain('Dockerfile');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('FROM ubuntu:22.04');
      expect(blocks[0]).toContain('wget');
    });

    it('10. docker-compose.yml bold heading', () => {
      const result = extractAIAnswer(fb1_dockerCompose);
      assertNoAnsiLeaks(result);

      expect(result).toContain('docker-compose.yml');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('services:');
    });

    it('11. panel code starting with port number', () => {
      const result = extractAIAnswer(fb1_portNumber);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(result).not.toMatch(/^3000\./m);
    });

    it('12. ANSI 256-color code fully stripped', () => {
      const result = extractAIAnswer(fb1_ansi256Color);
      assertNoAnsiLeaks(result);
      expect(result).toContain('Warning: resource limit exceeded');
    });

    it('13. Go interface{} type should not cause issues', () => {
      const result = extractAIAnswer(fb1_goInterface);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('interface{}');
    });

    it('14. two YAML blocks separated by prose', () => {
      const result = extractAIAnswer(fb1_twoYamlBlocks);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(2);
      expect(blocks[0]).toContain('Namespace');
      expect(blocks[1]).toContain('Deployment');
    });

    it('15. shell backtick substitution at column 0', () => {
      const result = extractAIAnswer(fb1_shellBacktick);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks.some(b => b.includes('kubectl get pods'))).toBe(true);
    });

    it('16. Makefile heading with tab-indented content', () => {
      const result = extractAIAnswer(fb1_makefileTab);
      assertNoAnsiLeaks(result);

      expect(result).toContain('Makefile');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('build:');
    });

    it('17. YAML folded scalar with > indicator', () => {
      const result = extractAIAnswer(fb1_yamlFoldedScalar);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('description: >');
      expect(blocks[0]).toContain('long description');
      expect(blocks[0]).toContain('port: 8080');
    });

    it('18. indented code after numbered list item', () => {
      const result = extractAIAnswer(fb1_indentedCodeAfterList);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks.some(b => b.includes('kubectl apply'))).toBe(true);
    });

    it('19. requirements.txt with pip freeze output', () => {
      const result = extractAIAnswer(fb1_requirementsTxt);
      assertNoAnsiLeaks(result);

      expect(result).toContain('requirements.txt');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('flask==2.3.0');
      expect(blocks[0]).toContain('gunicorn==21.2.0');
    });

    it('20. bare code followed by bare YAML creates 2 blocks', () => {
      const result = extractAIAnswer(fb1_bareCodeThenYaml);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(2);
      expect(blocks.some(b => b.includes('kubectl create'))).toBe(true);
      expect(blocks.some(b => b.includes('apiVersion'))).toBe(true);
    });

    it('21. hyphenated filename my-app.yaml', () => {
      const result = extractAIAnswer(fb1_hyphenatedFilename);
      assertNoAnsiLeaks(result);

      expect(result).toContain('my-app.yaml');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('apiVersion');
    });

    it('22. ANSI code split across line boundary', () => {
      const result = extractAIAnswer(fb1_ansiSplitLine);
      assertNoAnsiLeaks(result);
      expect(result).toContain('The config is');
      expect(result).toContain('End of output');
    });

    it('23. Windows-style paths in panel content', () => {
      const result = extractAIAnswer(fb1_windowsPaths);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('C:\\Users');
    });

    it('24. very long line in panel exceeding 78 chars', () => {
      const result = extractAIAnswer(fb1_longPanelLine);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('pkg-config');
    });

    it('25. Dockerfile.prod compound extension heading', () => {
      const result = extractAIAnswer(fb1_dockerfileProd);
      assertNoAnsiLeaks(result);

      expect(result).toContain('Dockerfile.prod');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('FROM node:20-slim');
    });

    it('26. YAML flow-style mapping', () => {
      const result = extractAIAnswer(fb1_yamlFlowMapping);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const yamlBlock = blocks.find(b => b.includes('apiVersion'));
      expect(yamlBlock).toBeDefined();
      expect(yamlBlock!).toContain('{ app: web');
    });

    it('27. kubectl command with tabular output', () => {
      const result = extractAIAnswer(fb1_kubectlTabular);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const kubectlBlock = blocks.find(b => b.includes('kubectl get pods'));
      expect(kubectlBlock).toBeDefined();
      expect(kubectlBlock!).toContain('web-abc123');
    });

    it('28. panel code containing triple backticks', () => {
      const result = extractAIAnswer(fb1_panelTripleBacktick);
      assertNoAnsiLeaks(result);

      expect(result).toContain('README.md');
      expect(result).toContain('npm install');
    });

    it('29. tsconfig.json with JSON content', () => {
      const result = extractAIAnswer(fb1_tsconfigJson);
      assertNoAnsiLeaks(result);

      expect(result).toContain('tsconfig.json');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('compilerOptions');
    });

    it('30. indented line with flags should not be treated as prose', () => {
      const result = extractAIAnswer(fb1_flagsNotProse);
      assertNoAnsiLeaks(result);

      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('#!/bin/bash');
      expect(blocks[0]).toContain('--namespace');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Round 2
  // ═══════════════════════════════════════════════════════════════════════════
  describe('round 2', () => {
    it('1. non-K8s YAML ending with prose line containing colon', () => {
      const result = extractAIAnswer(fb2_nonK8sYamlProse);
      assertNoAnsiLeaks(result);
      expect(result).toContain('Note: you can also use Helm');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      for (const block of blocks) {
        expect(block).not.toContain('Note: you can also use Helm');
      }
    });

    it('2. bold file heading .gitignore', () => {
      const result = extractAIAnswer(fb2_gitignoreHeading);
      assertNoAnsiLeaks(result);
      expect(result).toContain('.gitignore');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('node_modules/');
    });

    it('3. bold file heading .dockerignore', () => {
      const result = extractAIAnswer(fb2_dockerignoreHeading);
      assertNoAnsiLeaks(result);
      expect(result).toContain('.dockerignore');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('node_modules');
    });

    it('4. YAML with --- separator between two documents', () => {
      const result = extractAIAnswer(fb2_yamlDocSeparator);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('Namespace');
      expect(blocks[0]).toContain('---');
      expect(blocks[0]).toContain('Service');
    });

    it('5. shell heredoc at column 0 with YAML-like body', () => {
      const result = extractAIAnswer(fb2_shellHeredoc);
      assertNoAnsiLeaks(result);
      expect(result).toContain('cat <<EOF');
      const blocks = extractCodeBlocks(result);
      expect(result).toContain('EOF');
      const yamlInSeparateBlock = blocks.some(
        b => b.includes('apiVersion:') && !b.includes('cat <<EOF')
      );
      expect(yamlInSeparateBlock).toBe(false);
    });

    it('6. ordered list items with code panels after each', () => {
      const result = extractAIAnswer(fb2_orderedListPanels);
      assertNoAnsiLeaks(result);
      expect(result).toMatch(/1\.\s/);
      expect(result).toMatch(/2\.\s/);
      expect(result).toMatch(/3\.\s/);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
    });

    it('7. bold file heading with unicode naïve.py', () => {
      const result = extractAIAnswer(fb2_unicodeFilename);
      assertNoAnsiLeaks(result);
      expect(result).toContain('naïve.py');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('def hello()');
    });

    it('8. panel content exactly 78 chars', () => {
      const result = extractAIAnswer(fb2_exact78Chars);
      assertNoAnsiLeaks(result);
      const exact78 = 'x'.repeat(78);
      expect(result).toContain(exact78);
    });

    it('9. bare non-K8s YAML starting with name:', () => {
      const result = extractAIAnswer(fb2_bareNonK8sYaml);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('name: my-app');
      expect(blocks[0]).toContain('author: someone');
    });

    it('10. --- separator between two non-K8s YAML sections', () => {
      const result = extractAIAnswer(fb2_nonK8sYamlSeparator);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const allBlockContent = blocks.join('\n');
      expect(allBlockContent).toContain('app1');
      expect(allBlockContent).toContain('app2');
    });

    it('11. panel content with nested ANSI reset mid-line', () => {
      const result = extractAIAnswer(fb2_nestedAnsiReset);
      assertNoAnsiLeaks(result);
      expect(result).toContain('echo');
      expect(result).toContain('hello world');
    });

    it('12. bold file heading Cargo.lock followed by TOML', () => {
      const result = extractAIAnswer(fb2_cargoLockToml);
      assertNoAnsiLeaks(result);
      expect(result).toContain('Cargo.lock');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('[[package]]');
      expect(blocks[0]).toContain('name = "serde"');
    });

    it('13. prose with period should not be file heading', () => {
      const result = extractAIAnswer(fb2_proseNotHeading);
      assertNoAnsiLeaks(result);
      expect(result).toContain('Hello world.');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(0);
    });

    it('14. markdown ## heading after code panel', () => {
      const result = extractAIAnswer(fb2_markdownHeadingAfterCode);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      for (const block of blocks) {
        expect(block).not.toContain('## Next Steps');
      }
      expect(result).toContain('## Next Steps');
    });

    it('15. python f-string with colon not confused as YAML', () => {
      const result = extractAIAnswer(fb2_pythonFString);
      assertNoAnsiLeaks(result);
      expect(result).toContain('print(f"Hello: {name}")');
      const yamlBlocks = result.match(/```yaml/g);
      expect(yamlBlocks).toBeNull();
    });

    it('16. panel content with tab characters', () => {
      const result = extractAIAnswer(fb2_makefileTabChars);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const allBlockContent = blocks.join('\n');
      expect(allBlockContent).toContain('build:');
    });

    it('17. deeply nested YAML stays in one block', () => {
      const result = extractAIAnswer(fb2_deeplyNestedYaml);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('level6: value');
      expect(blocks[0]).toContain('apiVersion: v1');
    });

    it('18. bold heading then blank line then YAML panel', () => {
      const result = extractAIAnswer(fb2_headingBlankLinePanel);
      assertNoAnsiLeaks(result);
      expect(result).toContain('values.yaml');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const allContent = blocks.join('\n');
      expect(allContent).toContain('replicaCount: 3');
    });

    it('19. closing brace at column 0 after code block', () => {
      const result = extractAIAnswer(fb2_closingBrace);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('}');
      const outsideBlocks = result.replace(/```[\s\S]*?```/g, '').trim();
      expect(outsideBlocks).not.toContain('}');
    });

    it('20. consecutive blank panel lines', () => {
      const result = extractAIAnswer(fb2_consecutiveBlanks);
      assertNoAnsiLeaks(result);
      expect(result).toContain('line one');
      expect(result).toContain('line two');
    });

    it('21. README.md heading with markdown content in panels', () => {
      const result = extractAIAnswer(fb2_readmeMdContent);
      assertNoAnsiLeaks(result);
      expect(result).toContain('README.md');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('# My Project');
    });

    it('22. ANSI bold inside panel content', () => {
      const result = extractAIAnswer(fb2_ansiBoldPanel);
      assertNoAnsiLeaks(result);
      expect(result).toContain('Important');
      expect(result).toContain('Run this command');
    });

    it('23. two bare apiVersion blocks with no separator', () => {
      const result = extractAIAnswer(fb2_twoApiVersionBlocks);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      const allContent = blocks.join('\n');
      expect(allContent).toContain('Namespace');
      expect(allContent).toContain('Deployment');
    });

    it('24. file heading path with double slash', () => {
      const result = extractAIAnswer(fb2_doubleSlashPath);
      assertNoAnsiLeaks(result);
      expect(result).toContain('main');
    });

    it('25. panel content starting with bullet dash item', () => {
      const result = extractAIAnswer(fb2_panelDashList);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const allContent = blocks.join('\n');
      expect(allContent).toContain('- name: nginx');
    });

    it('26. bare python import at column 0', () => {
      const result = extractAIAnswer(fb2_pythonImport);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('import os');
      expect(blocks[0]).toContain('from pathlib import Path');
    });

    it('27. prose lines with word-colon pattern and many words', () => {
      const result = extractAIAnswer(fb2_proseWordColon);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(0);
    });

    it('28. file heading with spaces in path', () => {
      const result = extractAIAnswer(fb2_spacesInPath);
      assertNoAnsiLeaks(result);
      expect(result).toContain('My App/config.yaml');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(0);
    });

    it('29. literal backslash-x1b text in panel content', () => {
      const result = extractAIAnswer(fb2_literalEscapeText);
      expect(result).toContain('\\x1b');
    });

    it('30. YAML key split across lines by terminal wrapping', () => {
      const result = extractAIAnswer(fb2_yamlKeySplit);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('averageUtilization');
      expect(blocks[0]).toContain('70');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Round 3
  // ═══════════════════════════════════════════════════════════════════════════
  describe('round 3', () => {
    it("1. heredoc with quoted delimiter <<'YAML'", () => {
      const result = extractAIAnswer(fb3_heredocQuotedDelim);
      assertNoAnsiLeaks(result);
      expect(result).toContain("cat <<'YAML'");
      const blocks = extractCodeBlocks(result);
      const yamlInSeparateBlock = blocks.some(
        b => b.includes('apiVersion:') && !b.includes("cat <<'YAML'")
      );
      expect(yamlInSeparateBlock).toBe(false);
    });

    it('2. bare YAML list with nested keys at column 0', () => {
      const result = extractAIAnswer(fb3_bareYamlList);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks.join('\n')).toContain('- name: nginx');
      expect(blocks.join('\n')).toContain('containerPort: 80');
    });

    it('3. numbered list with periods and interleaved code panels', () => {
      const result = extractAIAnswer(fb3_numberedListPanels);
      assertNoAnsiLeaks(result);
      expect(result).toContain('1.');
      expect(result).toContain('2.');
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(2);
    });

    it('4. Makefile with .PHONY and multiple targets', () => {
      const result = extractAIAnswer(fb3_makefilePhony);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const allContent = blocks.join('\n');
      expect(allContent).toContain('build:');
      expect(allContent).toContain('clean:');
    });

    it('5. tee heredoc for K8s manifest creation', () => {
      const result = extractAIAnswer(fb3_teeHeredoc);
      assertNoAnsiLeaks(result);
      expect(result).toContain('kubectl apply');
      const blocks = extractCodeBlocks(result);
      const yamlInSeparateBlock = blocks.some(
        b => b.includes('apiVersion:') && !b.includes('kubectl apply')
      );
      expect(yamlInSeparateBlock).toBe(false);
    });

    it('6. CSS code in panel should be wrapped', () => {
      const result = extractAIAnswer(fb3_cssPanel);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks.join('\n')).toContain('body {');
    });

    it('7. SQL query in panel should be wrapped', () => {
      const result = extractAIAnswer(fb3_sqlPanel);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks.join('\n')).toContain('SELECT name');
    });

    it('8. prose between two code panels stays as prose', () => {
      const result = extractAIAnswer(fb3_proseBetweenPanels);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      const allContent = blocks.join('\n');
      expect(allContent).not.toContain('Then check');
      expect(allContent).toContain('kubectl get pods');
      expect(allContent).toContain('kubectl logs pod-name');
    });

    it('9. bare JSON array output wrapped in code block', () => {
      const result = extractAIAnswer(fb3_bareJsonArray);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks.join('\n')).toContain('"name": "pod-1"');
    });

    it('10. multiple heredocs in one response', () => {
      const result = extractAIAnswer(fb3_multipleHeredocs);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      const yamlOnly = blocks.filter(b => b.includes('apiVersion:') && !b.includes('cat >'));
      expect(yamlOnly.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Round 4
  // ═══════════════════════════════════════════════════════════════════════════
  describe('round 4', () => {
    it('1. shell heredoc with <<-EOF keeps YAML body in same block', () => {
      const result = extractAIAnswer(fb4_heredocDashEof);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(result).not.toContain('```yaml');
      const yamlInSeparateBlock = blocks.some(
        b => b.includes('apiVersion: v1') && !b.includes('cat <<-EOF')
      );
      expect(yamlInSeparateBlock).toBe(false);
    });

    it('2. YAML merge-key line <<: *defaults stays inside yaml block', () => {
      const result = extractAIAnswer(fb4_yamlMergeKey);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('defaults: &defaults');
      expect(blocks[0]).toContain('<<: *defaults');
    });

    it('3. Makefile .PHONY and dependency targets stay in one code block', () => {
      const result = extractAIAnswer(fb4_makefilePhonyDeps);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('.PHONY: build deps clean');
      expect(blocks[0]).toContain('build: deps');
      expect(blocks[0]).toContain('deps:');
    });

    it('4. lowercase SQL panel content stays in one code block', () => {
      const result = extractAIAnswer(fb4_lowercaseSql);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('select name, age');
      expect(blocks[0]).toContain('from users');
      expect(blocks[0]).toContain('where age > 18');
    });

    it('5. Dockerfile panel with image tag keeps following lines in same block', () => {
      const result = extractAIAnswer(fb4_dockerfileImageTag);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('FROM gcr.io/distroless/cc-debian12:nonroot');
      expect(blocks[0]).toContain('WORKDIR /app');
      expect(blocks[0]).toContain('COPY --from=builder /app/bin /app/bin');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Round 5
  // ═══════════════════════════════════════════════════════════════════════════
  describe('round 5', () => {
    it('1. C/C++ #include headers stay in one code block', () => {
      const result = extractAIAnswer(fb5_cIncludeHeaders);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('#include <stdio.h>');
      expect(blocks[0]).toContain('int main()');
      expect(blocks[0]).toContain('return 0;');
    });

    it('2. Rust match arms with => are not converted to ordered lists', () => {
      const result = extractAIAnswer(fb5_rustMatchArms);
      assertNoAnsiLeaks(result);
      expect(result).not.toMatch(/^\d+\.\s+println!/m);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('match status');
      expect(blocks[0]).toContain('200 =>');
    });

    it('3. Shell backslash continuation stays in one code block', () => {
      const result = extractAIAnswer(fb5_shellBackslashContinuation);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('docker run');
      expect(blocks[0]).toContain('--name mycontainer');
      expect(blocks[0]).toContain('-d nginx:latest');
    });

    it('4. TypeScript interface is not split by YAML detection', () => {
      const result = extractAIAnswer(fb5_tsInterface);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('interface User');
      expect(blocks[0]).toContain('name: string;');
      expect(blocks[0]).toContain('age: number;');
    });

    it('5. JSON object in Rich panel keeps all content in code blocks', () => {
      const result = extractAIAnswer(fb5_jsonObject);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const allBlockContent = blocks.join('\n');
      expect(allBlockContent).toContain('"apiVersion": "v1"');
    });

    it('6. Python triple-quote string with YAML-like content stays in one block', () => {
      const result = extractAIAnswer(fb5_pythonTripleQuoteYaml);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      const allBlockContent = blocks.join('\n');
      expect(allBlockContent).toContain('apiVersion: v1');
    });

    it('7. Go struct with JSON tags stays in one code block', () => {
      const result = extractAIAnswer(fb5_goStructJsonTags);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('type Pod struct');
      expect(blocks[0]).toContain('Name      string');
      expect(blocks[0]).toContain('Status    string');
    });

    it('8. kubectl get pods output stays in one code block', () => {
      const result = extractAIAnswer(fb5_kubectlGetPods);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('NAME');
      expect(blocks[0]).toContain('nginx-deployment');
      expect(blocks[0]).toContain('redis-master-0');
    });

    it('9. Prose with panel code gets first code block wrapped', () => {
      const result = extractAIAnswer(fb5_proseWithPanelCode);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain('npm install express');
      expect(result).toContain('app.listen(3000)');
    });

    it('10. YAML with boolean and numeric values stays in one block', () => {
      const result = extractAIAnswer(fb5_yamlBooleanValues);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('apiVersion: v1');
      expect(blocks[0]).toContain('debug: "true"');
      expect(blocks[0]).toContain('verbose: "false"');
    });

    it('11. Shell case statement stays in one code block', () => {
      const result = extractAIAnswer(fb5_shellCaseStatement);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('case "$1" in');
      expect(blocks[0]).toContain('esac');
    });

    it('12. Terraform HCL resource block stays in one code block', () => {
      const result = extractAIAnswer(fb5_terraformHcl);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('resource "azurerm_kubernetes_cluster"');
      expect(blocks[0]).toContain('dns_prefix');
    });

    it('13. Docker Compose YAML stays in one block', () => {
      const result = extractAIAnswer(fb5_dockerComposeYaml);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(1);
      expect(blocks[0]).toContain('services:');
      expect(blocks[0]).toContain('image: nginx:latest');
      expect(blocks[0]).toContain('POSTGRES_PASSWORD: secret');
    });

    it('14. Rust with lifetime annotations has code in blocks', () => {
      const result = extractAIAnswer(fb5_rustLifetimes);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks[0]).toContain("fn longest<'a>");
    });

    it('15. Numbered steps with shell commands render correctly', () => {
      const result = extractAIAnswer(fb5_numberedStepsShell);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBe(3);
      expect(blocks[0]).toContain('kubectl create namespace');
      expect(blocks[1]).toContain('kubectl apply');
      expect(blocks[2]).toContain('kubectl get pods');
    });
  });

  describe('round 6', () => {
    it('1. Java try-catch-finally stays in one code block', () => {
      const result = extractAIAnswer(fb6_javaTryCatchFinally);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('try {');
      expect(all).toContain('catch');
      expect(all).toContain('finally');
    });

    it('2. Print/log statements detected as code', () => {
      const result = extractAIAnswer(fb6_printLogStatements);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('console.log');
    });

    it('3. Arrow functions and modern JS syntax in code block', () => {
      const result = extractAIAnswer(fb6_arrowFunctions);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('=>');
      expect(all).toContain('res.json');
    });

    it('4. TypeScript interface with colon-typed members stays in code block', () => {
      const result = extractAIAnswer(fb6_tsInterfaceColonMembers);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('interface PodStatus');
      expect(all).toContain('name: string');
      expect(all).toContain('restartCount: number');
    });

    it('5. Shell until loop stays in one code block', () => {
      const result = extractAIAnswer(fb6_shellUntilLoop);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('until');
      expect(all).toContain('done');
    });

    it('6. Prose between two code blocks keeps them separate', () => {
      const result = extractAIAnswer(fb6_proseBetweenCodeBlocks);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(2);
      expect(blocks[0]).toContain('create namespace');
      expect(blocks[1]).toContain('kubectl apply');
    });

    it('7. Python f-string with braces stays in code block', () => {
      const result = extractAIAnswer(fb6_pythonFStringBraces);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('logger.info');
      expect(all).toContain('logger.error');
    });

    it('8. K8s YAML with anchors and aliases stays in one block', () => {
      const result = extractAIAnswer(fb6_yamlAnchorsAliases);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('apiVersion');
      expect(all).toContain('500m');
    });

    it('9. Rust enum with derive and variants stays in one block', () => {
      const result = extractAIAnswer(fb6_rustEnumDerive);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('#[derive');
      expect(all).toContain('pub enum AppError');
    });

    it('10. Shell if/elif/else/fi stays in one block', () => {
      const result = extractAIAnswer(fb6_shellIfElifElse);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('if kubectl');
      expect(all).toContain('fi');
    });

    it('11. Go goroutine with channel stays in code block', () => {
      const result = extractAIAnswer(fb6_goGoroutineChannel);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('func worker');
      expect(all).toContain('results <- j * 2');
    });

    it('12. Docker run with backslash continuation stays together', () => {
      const result = extractAIAnswer(fb6_dockerRunBackslash);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('docker run');
      expect(all).toContain('myimage:latest');
    });

    it('13. Java annotations and class stay in one block', () => {
      const result = extractAIAnswer(fb6_javaAnnotationsClass);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('@RestController');
      expect(all).toContain('class UserController');
    });

    it('14. kubectl patch with inline JSON stays in one block', () => {
      const result = extractAIAnswer(fb6_kubectlPatchJson);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('kubectl patch');
      expect(all).toContain('kubectl get pods');
    });

    it('15. YAML and shell blocks separated by prose', () => {
      const result = extractAIAnswer(fb6_yamlShellProseSeparated);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(2);
      const all = blocks.join('\n');
      expect(all).toContain('apiVersion: v1');
      expect(all).toContain('kubectl apply');
    });
  });

  describe('round 7', () => {
    it('1. Lua code with local and function detected as code', () => {
      const result = extractAIAnswer(fb7_luaLocalFunction);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('local M');
      expect(all).toContain('function M.setup');
    });

    it('2. Export environment variables detected as shell code', () => {
      const result = extractAIAnswer(fb7_exportEnvVars);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('export KUBECONFIG');
      expect(all).toContain('export REGISTRY');
    });

    it('3. awk and sed commands detected as code', () => {
      const result = extractAIAnswer(fb7_awkSedCommands);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('awk');
      expect(all).toContain('sed');
    });

    it('4. CSS rules detected as code block', () => {
      const result = extractAIAnswer(fb7_cssRules);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('.container {');
      expect(all).toContain('display: flex');
    });

    it('5. Protobuf message definition detected as code', () => {
      const result = extractAIAnswer(fb7_protobufMessage);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('syntax = "proto3"');
      expect(all).toContain('message PodMetrics');
    });

    it('6. Systemd unit file stays in one block', () => {
      const result = extractAIAnswer(fb7_systemdUnitFile);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('[Unit]');
      expect(all).toContain('[Service]');
    });

    it('7. Shell pipe chain with line continuations stays together', () => {
      const result = extractAIAnswer(fb7_shellPipeChain);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('kubectl get pods');
      expect(all).toContain('head -10');
    });

    it('8. Shell script with variables and commands stays together', () => {
      const result = extractAIAnswer(fb7_shellScriptVarsCommands);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('#!/bin/bash');
      expect(all).toContain('kubectl set image');
    });

    it('9. JSON configuration object stays in one block', () => {
      const result = extractAIAnswer(fb7_jsonConfigObject);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('"scripts"');
      expect(all).toContain('"test"');
    });

    it('10. Ruby class with methods stays in one block', () => {
      const result = extractAIAnswer(fb7_rubyClassMethods);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('class KubernetesClient');
      expect(all).toContain('def get_pods');
    });

    it('11. Kotlin data class detected as code', () => {
      const result = extractAIAnswer(fb7_kotlinDataClass);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('data class PodInfo');
      expect(all).toContain('val name');
    });

    it('12. C struct typedef stays in one code block', () => {
      const result = extractAIAnswer(fb7_cStructTypedef);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('typedef struct');
      expect(all).toContain('ServiceConfig');
    });

    it('13. az CLI commands with JMESPath queries stay in one block', () => {
      const result = extractAIAnswer(fb7_azCliJmesPath);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('az aks show');
      expect(all).toContain('--output table');
    });

    it('14. Python async function with type hints stays in one block', () => {
      const result = extractAIAnswer(fb7_pythonAsyncTypeHints);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('async def get_pods');
      expect(all).toContain('await client');
    });

    it('15. Numbered steps with code blocks render separately', () => {
      const result = extractAIAnswer(fb7_numberedStepsCodeBlocks);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(3);
      const all = blocks.join('\n');
      expect(all).toContain('create secret');
      expect(all).toContain('kubectl apply');
      expect(all).toContain('kubectl get all');
    });
  });

  describe('round 8', () => {
    it('1. Go struct literal with field: value stays in code block', () => {
      const result = extractAIAnswer(fb8_goStructLiteral);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('config :=');
      expect(all).toContain('Host:');
      expect(all).toContain('MaxConns: 100');
    });

    it('2. Python function call with kwargs stays in code block', () => {
      const result = extractAIAnswer(fb8_pythonKwargs);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('logging.basicConfig');
      expect(all).toContain('FileHandler');
    });

    it('3. Shell trap and source commands detected as code', () => {
      const result = extractAIAnswer(fb8_shellTrapSource);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('#!/bin/bash');
      expect(all).toContain('trap');
    });

    it('4. GitHub Actions YAML workflow stays in one block', () => {
      const result = extractAIAnswer(fb8_githubActionsYaml);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('name: Deploy');
      expect(all).toContain('runs-on');
    });

    it('5. Rust closures and iterator chains stay in one block', () => {
      const result = extractAIAnswer(fb8_rustClosuresIterators);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('let results');
      expect(all).toContain('.collect()');
    });

    it('6. Shell heredoc with YAML content stays in one block', () => {
      const result = extractAIAnswer(fb8_shellHeredocYaml);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('cat <<EOF');
      expect(all).toContain('apiVersion: v1');
      expect(all).toContain('EOF');
    });

    it('7. Docker Compose with build context stays in one block', () => {
      const result = extractAIAnswer(fb8_dockerComposeBuildContext);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('version:');
      expect(all).toContain('depends_on');
    });

    it('8. Shell function definition stays in one block', () => {
      const result = extractAIAnswer(fb8_shellFunctionDef);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('check_pod_ready()');
      expect(all).toContain('kubectl get pod');
    });

    it('9. Python nested expressions stay in code block', () => {
      const result = extractAIAnswer(fb8_pythonNestedExpressions);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('import json');
      expect(all).toContain('json.dumps');
    });

    it('10. Terraform with multiple resource types stays in one block', () => {
      const result = extractAIAnswer(fb8_terraformMultipleResources);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('provider "azurerm"');
      expect(all).toContain('resource "azurerm_kubernetes_cluster"');
    });

    it('11. SQL JOIN query stays in one code block', () => {
      const result = extractAIAnswer(fb8_sqlJoinQuery);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('SELECT');
      expect(all).toContain('INNER JOIN');
    });

    it('12. K8s CRD definition stays in one YAML block', () => {
      const result = extractAIAnswer(fb8_k8sCrdDefinition);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('apiextensions.k8s.io');
      expect(all).toContain('openAPIV3Schema');
    });

    it('13. Swift struct with properties stays in code block', () => {
      const result = extractAIAnswer(fb8_swiftStructProperties);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('struct PodInfo');
      expect(all).toContain('isReady');
    });

    it('14. Makefile with ifeq conditional stays in one block', () => {
      const result = extractAIAnswer(fb8_makefileIfeq);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('REGISTRY');
      expect(all).toContain('docker build');
    });

    it('15. Elixir module with functions stays in one block', () => {
      const result = extractAIAnswer(fb8_elixirModule);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('defmodule');
      expect(all).toContain('get_pods');
    });
  });

  describe('round 9', () => {
    it('1. TypeScript generic types not confused with HTML tags', () => {
      const result = extractAIAnswer(fb9_tsGenericTypes);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('KubernetesClient');
      expect(all).toContain('client.list');
    });

    it('2. PHP class with namespace stays in one block', () => {
      const result = extractAIAnswer(fb9_phpClassNamespace);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('<?php');
      expect(all).toContain('class PodController');
    });

    it('3. Scala case class detected as code', () => {
      const result = extractAIAnswer(fb9_scalaCaseClass);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('case class Pod');
      expect(all).toContain('object PodService');
    });

    it('4. Shell arrays and parameter expansion stay in code block', () => {
      const result = extractAIAnswer(fb9_shellArraysParamExpansion);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('NAMESPACES=');
      expect(all).toContain('done');
    });

    it('5. INI config file detected as code block', () => {
      const result = extractAIAnswer(fb9_iniConfigFile);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('[global]');
      expect(all).toContain('scrape_interval');
    });

    it('6. Rust with turbofish and type annotations stays in code block', () => {
      const result = extractAIAnswer(fb9_rustTurbofish);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('serde_json');
      expect(all).toContain('collect::<Vec');
    });

    it('7. Python multi-line string stays in code block', () => {
      const result = extractAIAnswer(fb9_pythonMultiLineString);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('YAML_TEMPLATE');
      expect(all).toContain('kind: Deployment');
    });

    it('8. Java Spring Boot service stays in one block', () => {
      const result = extractAIAnswer(fb9_javaSpringBootService);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('@Service');
      expect(all).toContain('listPods');
    });

    it('9. Shell with here-string stays in code block', () => {
      const result = extractAIAnswer(fb9_shellHereString);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('kubectl get nodes');
      expect(all).toContain('done');
    });

    it('10. curl with JSON body stays in one block', () => {
      const result = extractAIAnswer(fb9_curlJsonBody);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('curl -X POST');
      expect(all).toContain('"namespace"');
    });

    it('11. Kotlin suspend function stays in code block', () => {
      const result = extractAIAnswer(fb9_kotlinSuspendFunction);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('suspend fun');
      expect(all).toContain('withContext');
    });

    it('12. Terraform locals and data sources stay in one block', () => {
      const result = extractAIAnswer(fb9_terraformLocalsData);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('locals {');
      expect(all).toContain('data "azurerm_client_config"');
    });

    it('13. Markdown table passes through without code wrapping', () => {
      const result = extractAIAnswer(fb9_markdownTable);
      assertNoAnsiLeaks(result);
      // Tables should NOT be in code blocks
      expect(result).toContain('| Name | Status |');
      const blocks = extractCodeBlocks(result);
      const all = blocks.join('\n');
      expect(all).not.toContain('| Name |');
    });

    it('14. Shell process substitution stays in code block', () => {
      const result = extractAIAnswer(fb9_shellProcessSubstitution);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('diff');
      expect(all).toContain('kubectl get cm');
    });

    it('15. Requirements.txt content stays in code block', () => {
      const result = extractAIAnswer(fb9_requirementsTxt);
      assertNoAnsiLeaks(result);
      const blocks = extractCodeBlocks(result);
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const all = blocks.join('\n');
      expect(all).toContain('flask==3.0.0');
      expect(all).toContain('kubernetes==28.1.0');
    });
  });
});
