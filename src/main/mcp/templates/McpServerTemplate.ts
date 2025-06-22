export interface McpServerTemplateInfo {
  id: string;
  name: string;
  description: string;
  category: 'filesystem' | 'web' | 'weather' | 'productivity' | 'development' | 'custom';
  icon: string;
  npmPackage?: string;
  version?: string;
  defaultEnabled: boolean;
  requiresConfig: boolean;
  configFields: McpConfigField[];
  documentation?: string;
  examples?: string[];
}

export interface McpConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'boolean' | 'select' | 'path';
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: string[];
  validation?: RegExp;
  defaultValue?: any;
}

export interface McpInstallationResult {
  success: boolean;
  error?: string;
  installedVersion?: string;
  command?: string;
  args?: string[];
}

export abstract class McpServerTemplate {
  protected info: McpServerTemplateInfo;

  constructor(info: McpServerTemplateInfo) {
    this.info = info;
  }

  getInfo(): McpServerTemplateInfo {
    return { ...this.info };
  }

  abstract generateConfig(userConfig: Record<string, any>): {
    command: string;
    args: string[];
    env?: Record<string, string>;
  };

  abstract validateConfig(config: Record<string, any>): {
    valid: boolean;
    errors: string[];
  };

  async checkInstallation(): Promise<boolean> {
    if (!this.info.npmPackage) return true;
    
    try {
      const { spawn } = await import('child_process');
      
      return new Promise((resolve) => {
        const child = spawn('npm', ['list', '--depth=0', this.info.npmPackage!], {
          stdio: 'pipe',
          shell: true
        });
        
        let output = '';
        child.stdout?.on('data', (data) => {
          output += data.toString();
        });
        
        child.on('close', (code) => {
          const isInstalled = code === 0 && output.includes(this.info.npmPackage!);
          resolve(isInstalled);
        });
        
        child.on('error', () => resolve(false));
      });
    } catch (error) {
      console.error('Error checking installation:', error);
      return false;
    }
  }

  async install(): Promise<McpInstallationResult> {
    if (!this.info.npmPackage) {
      return { success: true };
    }

    try {
      const { spawn } = await import('child_process');
      
      return new Promise((resolve) => {
        const packageSpec = this.info.version 
          ? `${this.info.npmPackage}@${this.info.version}`
          : this.info.npmPackage!;
        
        const child = spawn('npm', ['install', '-g', packageSpec], {
          stdio: 'pipe',
          shell: true
        });
        
        let errorOutput = '';
        
        child.stdout?.on('data', () => {
          // stdout captured for installation logging
        });
        
        child.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        child.on('close', (code) => {
          if (code === 0) {
            resolve({ 
              success: true, 
              installedVersion: this.info.version,
              command: 'npm',
              args: ['install', '-g', packageSpec]
            });
          } else {
            resolve({ 
              success: false, 
              error: errorOutput || 'Installation failed',
              command: 'npm',
              args: ['install', '-g', packageSpec]
            });
          }
        });
        
        child.on('error', (error) => {
          resolve({ 
            success: false, 
            error: error.message,
            command: 'npm',
            args: ['install', '-g', packageSpec]
          });
        });
      });
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  async uninstall(): Promise<McpInstallationResult> {
    if (!this.info.npmPackage) {
      return { success: true };
    }

    try {
      const { spawn } = await import('child_process');
      
      return new Promise((resolve) => {
        const child = spawn('npm', ['uninstall', '-g', this.info.npmPackage!], {
          stdio: 'pipe',
          shell: true
        });
        
        let errorOutput = '';
        
        child.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        child.on('close', (code) => {
          if (code === 0) {
            resolve({ 
              success: true,
              command: 'npm',
              args: ['uninstall', '-g', this.info.npmPackage!]
            });
          } else {
            resolve({ 
              success: false, 
              error: errorOutput || 'Uninstallation failed',
              command: 'npm',
              args: ['uninstall', '-g', this.info.npmPackage!]
            });
          }
        });
        
        child.on('error', (error) => {
          resolve({ 
            success: false, 
            error: error.message,
            command: 'npm',
            args: ['uninstall', '-g', this.info.npmPackage!]
          });
        });
      });
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  protected validateField(field: McpConfigField, value: any): string | null {
    if (field.required && (value === undefined || value === null || value === '')) {
      return `${field.label} is required`;
    }

    if (value && field.validation && !field.validation.test(String(value))) {
      return `${field.label} format is invalid`;
    }

    return null;
  }
} 