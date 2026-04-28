// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import {
  Headlamp,
  registerAddClusterProvider,
  registerAppLogo,
  registerAppTheme,
  registerRoute,
  registerSidebarEntry,
} from '@kinvolk/headlamp-plugin/lib';
import RegisterAKSClusterPage from './components/AKS/RegisterAKSClusterPage';
import AzureLoginPage from './components/AzureAuth/AzureLoginPage';
import AzureProfilePage from './components/AzureAuth/AzureProfilePage';
import AzureLogo from './components/Logo/Logo';
import { getLoginStatus } from './utils/azure/az-auth';
import { AZURE_ACCOUNT_POLL_INTERVAL_MS } from './utils/constants/timing';
import { azureTheme } from './utils/shared/theme';

Headlamp.setAppMenu(menus => {
  // Find the Help menu
  const helpMenu = menus?.find(menu => menu.id === 'original-help');

  if (helpMenu && helpMenu.submenu) {
    // Replace Documentation link
    const docIndex = helpMenu.submenu.findIndex(item => item.id === 'original-documentation');
    if (docIndex !== -1) {
      helpMenu.submenu[docIndex] = {
        label: 'Documentation',
        id: 'aks-documentation',
        url: 'https://aka.ms/aks/aks-desktop',
      };
    }

    // Replace Open Issue link
    const issueIndex = helpMenu.submenu.findIndex(item => item.id === 'original-open-issue');
    if (issueIndex !== -1) {
      helpMenu.submenu[issueIndex] = {
        label: 'Open an Issue',
        id: 'aks-open-issue',
        url: 'https://github.com/Azure/aks-desktop/issues',
      };
    }
  }

  return menus;
});

// add azure related components only if running as app
if (Headlamp.isRunningAsApp()) {
  // register azure logo
  registerAppLogo(AzureLogo);

  // register the theme and make it default
  registerAppTheme(azureTheme);
  if (!localStorage.getItem('headlampThemePreference')) {
    localStorage.setItem('headlampThemePreference', 'Azure Theme');
    localStorage.setItem('cached-current-theme', `${azureTheme}`);
  }

  // Initialize Azure auth status on window object for Headlamp integration
  (window as any).__azureAuthStatus = {
    isLoggedIn: false,
    isChecking: true,
    username: undefined,
  };

  // Azure Profile (in main sidebar)
  registerSidebarEntry({
    name: 'azure-profile',
    url: '/azure/profile',
    icon: 'mdi:account-circle',
    parent: null,
    label: 'Azure Account',
    useClusterURL: false,
    sidebar: 'HOME',
  });

  // Update Azure Account label based on login status
  let currentUsername: string | null = null;

  const updateAzureAccountLabel = async () => {
    try {
      const status = await getLoginStatus();

      // Expose auth status to window object for headlamp components
      (window as any).__azureAuthStatus = {
        isLoggedIn: status.isLoggedIn,
        isChecking: false,
        username: status.username,
        tenantId: status.tenantId,
        subscriptionId: status.subscriptionId,
        error: status.error,
      };

      if (status.isLoggedIn && status.username) {
        const displayName = status.username.split('@')[0];
        if (currentUsername !== displayName) {
          currentUsername = displayName;
          registerSidebarEntry({
            name: 'azure-profile',
            url: '/azure/profile',
            icon: 'mdi:account-circle',
            parent: null,
            label: displayName,
            useClusterURL: false,
            sidebar: 'HOME',
          });
        }
      } else if (currentUsername !== null) {
        currentUsername = null;
        registerSidebarEntry({
          name: 'azure-profile',
          url: '/azure/profile',
          icon: 'mdi:account-circle',
          parent: null,
          label: 'Azure Account',
          useClusterURL: false,
          sidebar: 'HOME',
        });
      }
    } catch (error) {
      // Update auth status to indicate error/not logged in
      (window as any).__azureAuthStatus = {
        isLoggedIn: false,
        isChecking: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  // Check initially
  updateAzureAccountLabel();

  // Listen for custom events from login/logout operations
  window.addEventListener('azure-auth-update', updateAzureAccountLabel);

  // Check when window regains focus (user might have logged in/out externally)
  let isWindowFocused = document.hasFocus();
  window.addEventListener('focus', () => {
    if (!isWindowFocused) {
      isWindowFocused = true;
      updateAzureAccountLabel();
    }
  });
  window.addEventListener('blur', () => {
    isWindowFocused = false;
  });

  // Fallback: Check periodically with a longer interval (30 seconds) as a safety net
  setInterval(updateAzureAccountLabel, AZURE_ACCOUNT_POLL_INTERVAL_MS);

  // Register Azure authentication routes
  registerRoute({
    path: '/azure/login',
    // @ts-ignore todo: fix component type
    component: AzureLoginPage,
    name: 'Azure Login',
    exact: true,
    sidebar: {
      item: 'azure-profile',
      sidebar: 'HOME',
    },
    noAuthRequired: true, // This route doesn't require auth
    useClusterURL: false,
  });

  registerRoute({
    path: '/azure/profile',
    component: AzureProfilePage,
    name: 'Azure Profile',
    sidebar: {
      sidebar: 'HOME',
      item: 'azure-profile',
    },
    exact: true,
    noAuthRequired: true,
    useClusterURL: false,
  });

  // Register AKS as a cluster provider in the "Add Cluster" page
  registerAddClusterProvider({
    title: 'Azure Kubernetes Service',
    // @ts-ignore todo fix registerAddClusterProvider icon to take string
    icon: 'logos:microsoft-azure',
    description:
      'Connect to an existing AKS (Azure Kubernetes Service) cluster from your Azure subscription. Requires Azure CLI authentication.',
    url: '/add-cluster-aks',
  });

  // Register route for the AKS cluster registration dialog
  registerRoute({
    path: '/add-cluster-aks',
    component: RegisterAKSClusterPage,
    name: 'Register AKS Cluster',
    sidebar: null,
    exact: true,
    useClusterURL: false,
    noAuthRequired: true,
  });
}
