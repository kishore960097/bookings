// Ambient module declarations for packages before `npm install` runs
declare module 'helmet';
declare module 'express-rate-limit';
declare module '@capacitor/cli' {
  export interface CapacitorConfig {
    appId?: string;
    appName?: string;
    webDir?: string;
    server?: {
      androidScheme?: string;
      hostname?: string;
      url?: string;
      cleartext?: boolean;
      allowNavigation?: string[];
    };
    android?: {
      allowMixedContent?: boolean;
    };
    [key: string]: any;
  }
}
declare module '@firebase/rules-unit-testing' {
  export interface RulesTestEnvironment {
    cleanup(): Promise<void>;
    clearStorage(): Promise<void>;
    clearFirestore(): Promise<void>;
    withSecurityRulesDisabled(cb: (context: any) => Promise<void>): Promise<void>;
    authenticatedContext(uid: string, claims?: Record<string, any>): any;
    unauthenticatedContext(): any;
  }
  export function initializeTestEnvironment(options: any): Promise<RulesTestEnvironment>;
  export function assertFails(pr: Promise<any>): Promise<any>;
  export function assertSucceeds(pr: Promise<any>): Promise<any>;
}
