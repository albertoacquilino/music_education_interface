/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

import { Routes } from '@angular/router';

/**
 * Defines the application routes for the Music Education Interface.
 * This configuration sets up the navigation paths and loading of components.
 */
export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home', // Redirects to the home route
    pathMatch: 'full', // Ensures the entire URL path matches
  },

  // Uncomment and configure the following routes as needed
  // {
  //   path: '',
  //   loadComponent: () => import('./pages/signin/signin.page').then(m => m.SigninPage),
  //   canActivate: [authGuard] // Protects the route with an authentication guard
  // },
  // {
  //   path: 'signup',
  //   loadComponent: () => import('./pages/signup/signup.page').then(m => m.SignupPage),
  // },
  // {
  //   path: 'register',
  //   loadComponent: () => import('./pages/register/register.page').then(m => m.RegisterPage),
  // },
  // {
  //   path: 'profile',
  //   loadComponent: () => import('./pages/profile/profile.page').then(m => m.ProfilePage),
  // },

  {
    path: 'home',
    loadComponent: () => import('./pages/tabs/tabs.page').then(m => m.TabsComponent), // Loads the TabsComponent for the home route
    children: [
      {
        path: 'exercise',
        loadComponent: () => import('./pages/home/home.page').then(m => m.HomePage), // Loads the HomePage for the exercise route
      },
      {
        path: 'intonation',
        loadComponent: () => import(
          './pages/target-intonation/target-intonation.page'
        ).then(m => m.TargetIntonationPage),
      },
      {
        path: '',
        redirectTo: 'exercise', // Redirects to the exercise route by default
        pathMatch: 'full',
      }
    ]
  },

  // Uncomment and configure the following routes as needed
  // {
  //   path: 'scroll-image-page',
  //   loadComponent: () => import('./components/scroll-image-selector/scroll-image-test-page').then(m => m.ScrollImagePage),
  // },
  // {
  //   path: 'score',
  //   loadComponent: () => import('./pages/score-test.component').then(m => m.ScoreComponentTest),
  // },
  // {
  //   path: 'dynamics',
  //   loadComponent: () => import('./pages/dynamics-test.component').then(m => m.ScoreComponentTest),
  // }
];
