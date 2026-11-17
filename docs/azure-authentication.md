# Azure authentication

AKS Desktop supports native Azure sign-in for REST-based features and a separate,
optional Azure CLI sign-in for features that still execute `az`, `kubelogin`, or
other CLI-backed operations.

## Native sign-in

The shipped AKS plugin starts the
[Microsoft identity platform device authorization flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code)
through a private Headlamp capability. Device-code polling, refresh-token storage,
token caching, and refresh-token rotation run in Electron's main process. The
renderer receives the user prompt, account metadata, and requested access tokens;
refresh tokens are not exposed to plugin code or persisted in browser storage.

The product manifest limits the capability to the exact shipped plugin identity,
known Azure clouds, and approved token scopes. Main-process handlers also require
the trusted main frame and clear sessions when the document navigates or the app
closes.

Azure Resource Manager callers sometimes identify ARM by its request endpoint,
while the app registration uses the cloud's configured token resource. AKS Desktop
normalizes that endpoint scope before requesting a token. Microsoft documents the
`{resource}/.default` convention and ARM trailing-slash behavior in
[Scopes and permissions](https://learn.microsoft.com/en-us/entra/identity-platform/scopes-oidc#trailing-slash-and-default).
Public Azure, Azure US Government, and Azure China use separate, explicitly
allowlisted authorities and endpoints, following Microsoft's
[national cloud authentication guidance](https://learn.microsoft.com/en-us/entra/identity-platform/authentication-national-cloud).

## Azure CLI boundary

[Azure CLI interactive authentication](https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli-interactively)
is offered separately because some cluster registration, proxy, and data-plane
operations still require CLI tooling. Skipping or failing that step blocks those
operations without affecting native REST access.

Before CLI-backed work, AKS Desktop verifies the CLI account, tenant, cloud, and
target subscription against the active native session. Identity-changing CLI
commands are serialized, and capability operations retain a reader lease from
verification through completion so a queued login, logout, account switch, or
cloud switch cannot create a check/use race.

Signing out clears the in-memory native session, cancels pending device
authorization, blocks implicit CLI reuse, and separately attempts `az logout`.

