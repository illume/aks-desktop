// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { test } from "node:test";

const rootDir = path.resolve(__dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, "product-manifest.json"), "utf8"),
);

test("declares AKS product identity and policy outside Headlamp", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(
    {
      id: manifest.product.id,
      name: manifest.product.name,
      protocolScheme: manifest.product.protocolScheme,
      checkForUpdates: manifest.product.checkForUpdates,
    },
    {
      id: "com.microsoft.aks-desktop",
      name: "aks-desktop",
      protocolScheme: "aks-desktop",
      checkForUpdates: false,
    },
  );
  assert.equal(manifest.product.versionSource, "package.json");
});

test("references packaged legal documents", () => {
  for (const document of manifest.product.legalDocuments) {
    assert.equal(path.basename(document.file), document.file);
    assert.equal(fs.existsSync(path.join(rootDir, document.file)), true);
  }
});

test("declares plugin defaults and external tool integrity generation", () => {
  assert.equal(
    manifest.plugins.find((plugin: { id: string }) => plugin.id === "kaito")
      ?.enabledByDefault,
    false,
  );
  assert.equal(
    manifest.plugins.find(
      (plugin: { id: string }) => plugin.id === "aks-desktop",
    )?.enabledByDefault,
    true,
  );
  assert.deepEqual(
    manifest.externalTools.map((tool: { id: string }) => tool.id),
    ["azure-cli", "python", "az-kubelogin"],
  );
  assert.equal(
    manifest.externalTools.every(
      (tool: { resourcePath: string; sha256: string }) =>
        !path.isAbsolute(tool.resourcePath) &&
        tool.sha256 === "generated-during-assembly",
    ),
    true,
  );
});
