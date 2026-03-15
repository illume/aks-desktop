// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { _testing } from './agent/aksAgentManager';
import {
  fb1_twoFileHeadings,
  fb2_shellHeredoc,
  fb3_cssPanel,
  fb4_yamlMergeKey,
  fb5_cIncludeHeaders,
  fb6_javaTryCatchFinally,
  fb7_rubyClassMethods,
  fb8_k8sCrdDefinition,
  fb9_scalaCaseClass,
  fb10_configMapLiteralBlock,
  fb11_aksTroubleshooting,
  fb12_coreDNSCorefile,
  fb13_mixedMarkdownFormatting,
  fb14_panelCodeThenAlsoConfirm,
  fb15_assumptionsBetweenCodeBlocks,
} from './agent/findbugFixtures';
import ContentRenderer from './ContentRenderer';

const { extractAIAnswer } = _testing;

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    sidebar: { selectedBackground: '#555555' },
  },
});

const meta: Meta<typeof ContentRenderer> = {
  title: 'AIAssistant/SyntheticFixtures',
  component: ContentRenderer,
  decorators: [
    (Story: any) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};
export default meta;

// eslint-disable-next-line no-unused-vars
const noopYamlDetected = (_yaml: string, _resourceType: string) => {};

// ── Light theme stories ──────────────────────────────────────────────────────

export const Round01TwoFileHeadings: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb1_twoFileHeadings)}
  />
);

export const Round02ShellHeredoc: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(fb2_shellHeredoc)} />
);

export const Round03CssPanel: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(fb3_cssPanel)} />
);

export const Round04YamlMergeKey: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(fb4_yamlMergeKey)} />
);

export const Round05CIncludeHeaders: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb5_cIncludeHeaders)}
  />
);

export const Round06JavaTryCatchFinally: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb6_javaTryCatchFinally)}
  />
);

export const Round07RubyClassMethods: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb7_rubyClassMethods)}
  />
);

export const Round08K8sCrdDefinition: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb8_k8sCrdDefinition)}
  />
);

export const Round09ScalaCaseClass: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb9_scalaCaseClass)}
  />
);

export const Round10ConfigMapLiteralBlock: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb10_configMapLiteralBlock)}
  />
);

export const Round11AksTroubleshooting: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb11_aksTroubleshooting)}
  />
);

export const Round12CoreDnsCorefile: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb12_coreDNSCorefile)}
  />
);

export const Round13MixedMarkdownNegative: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb13_mixedMarkdownFormatting)}
  />
);

export const Round14PanelCodeThenAlsoConfirm: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb14_panelCodeThenAlsoConfirm)}
  />
);

export const Round15AssumptionsBetweenCodeBlocks: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb15_assumptionsBetweenCodeBlocks)}
  />
);

// ── Dark theme stories ───────────────────────────────────────────────────────

export const Round01TwoFileHeadingsDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(fb1_twoFileHeadings)}
    />
  </ThemeProvider>
);

export const Round02ShellHeredocDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(fb2_shellHeredoc)}
    />
  </ThemeProvider>
);

export const Round03CssPanelDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(fb3_cssPanel)} />
  </ThemeProvider>
);

export const Round04YamlMergeKeyDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(fb4_yamlMergeKey)}
    />
  </ThemeProvider>
);

export const Round05CIncludeHeadersDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(fb5_cIncludeHeaders)}
    />
  </ThemeProvider>
);

export const Round06JavaTryCatchFinallyDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(fb6_javaTryCatchFinally)}
    />
  </ThemeProvider>
);

export const Round07RubyClassMethodsDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(fb7_rubyClassMethods)}
    />
  </ThemeProvider>
);

export const Round08K8sCrdDefinitionDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(fb8_k8sCrdDefinition)}
    />
  </ThemeProvider>
);

export const Round09ScalaCaseClassDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(fb9_scalaCaseClass)}
    />
  </ThemeProvider>
);

export const Round10ConfigMapLiteralBlockDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(fb10_configMapLiteralBlock)}
    />
  </ThemeProvider>
);

export const Round11AksTroubleshootingDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(fb11_aksTroubleshooting)}
    />
  </ThemeProvider>
);

export const Round12CoreDnsCorefileDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(fb12_coreDNSCorefile)}
    />
  </ThemeProvider>
);

export const Round13MixedMarkdownNegativeDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(fb13_mixedMarkdownFormatting)}
    />
  </ThemeProvider>
);

export const Round14PanelCodeThenAlsoConfirmDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(fb14_panelCodeThenAlsoConfirm)}
    />
  </ThemeProvider>
);

export const Round15AssumptionsBetweenCodeBlocksDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(fb15_assumptionsBetweenCodeBlocks)}
    />
  </ThemeProvider>
);
