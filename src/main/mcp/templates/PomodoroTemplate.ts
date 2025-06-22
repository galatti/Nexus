import { McpServerTemplate, McpServerTemplateInfo } from './McpServerTemplate';

export class PomodoroTemplate extends McpServerTemplate {
  constructor() {
    const info: McpServerTemplateInfo = {
      id: 'pomodoro',
      name: 'Pomodoro Timer',
      description: 'Productivity timer following the Pomodoro Technique with customizable work and break intervals',
      category: 'productivity',
      icon: '🍅',
      npmPackage: undefined, // Custom server, no npm package needed
      version: undefined,
      defaultEnabled: true,
      requiresConfig: true,
      configFields: [
        {
          key: 'workDuration',
          label: 'Work Duration (minutes)',
          type: 'number',
          required: false,
          placeholder: '25',
          description: 'Duration of work intervals in minutes',
          defaultValue: 25
        },
        {
          key: 'shortBreakDuration',
          label: 'Short Break Duration (minutes)',
          type: 'number',
          required: false,
          placeholder: '5',
          description: 'Duration of short breaks in minutes',
          defaultValue: 5
        },
        {
          key: 'longBreakDuration',
          label: 'Long Break Duration (minutes)',
          type: 'number',
          required: false,
          placeholder: '15',
          description: 'Duration of long breaks in minutes',
          defaultValue: 15
        },
        {
          key: 'longBreakInterval',
          label: 'Long Break Interval',
          type: 'number',
          required: false,
          placeholder: '4',
          description: 'Number of work sessions before a long break',
          defaultValue: 4
        },
        {
          key: 'notifications',
          label: 'Desktop Notifications',
          type: 'boolean',
          required: false,
          description: 'Show desktop notifications for timer events',
          defaultValue: true
        },
        {
          key: 'autoStart',
          label: 'Auto-start Next Session',
          type: 'boolean',
          required: false,
          description: 'Automatically start the next session after a break',
          defaultValue: false
        }
      ],
      documentation: 'Built-in Pomodoro timer for productivity management',
      examples: [
        'Start a work session: "Start a 25-minute work timer"',
        'Take a break: "Start a 5-minute break"',
        'Check status: "How much time is left on my timer?"',
        'View stats: "Show my productivity stats for today"'
      ]
    };

    super(info);
  }

  generateConfig(userConfig: Record<string, any>): {
    command: string;
    args: string[];
    env?: Record<string, string>;
  } {
    // This is a custom built-in server, so we'll use a special command
    const { join } = require('path');
    return {
      command: 'node',
      args: [
        join(__dirname, '../servers/PomodoroServer.js') // Will create this custom server
      ],
      env: {
        POMODORO_WORK_DURATION: String(userConfig.workDuration || 25),
        POMODORO_SHORT_BREAK_DURATION: String(userConfig.shortBreakDuration || 5),
        POMODORO_LONG_BREAK_DURATION: String(userConfig.longBreakDuration || 15),
        POMODORO_LONG_BREAK_INTERVAL: String(userConfig.longBreakInterval || 4),
        POMODORO_NOTIFICATIONS: String(userConfig.notifications !== false),
        POMODORO_AUTO_START: String(userConfig.autoStart === true)
      }
    };
  }

  validateConfig(config: Record<string, any>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate work duration
    if (config.workDuration !== undefined) {
      const workDuration = Number(config.workDuration);
      if (isNaN(workDuration) || workDuration < 1 || workDuration > 120) {
        errors.push('Work duration must be between 1 and 120 minutes');
      }
    }

    // Validate short break duration
    if (config.shortBreakDuration !== undefined) {
      const shortBreak = Number(config.shortBreakDuration);
      if (isNaN(shortBreak) || shortBreak < 1 || shortBreak > 60) {
        errors.push('Short break duration must be between 1 and 60 minutes');
      }
    }

    // Validate long break duration
    if (config.longBreakDuration !== undefined) {
      const longBreak = Number(config.longBreakDuration);
      if (isNaN(longBreak) || longBreak < 1 || longBreak > 120) {
        errors.push('Long break duration must be between 1 and 120 minutes');
      }
    }

    // Validate long break interval
    if (config.longBreakInterval !== undefined) {
      const interval = Number(config.longBreakInterval);
      if (isNaN(interval) || interval < 2 || interval > 10) {
        errors.push('Long break interval must be between 2 and 10 sessions');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Override installation check since this is a built-in server
  async checkInstallation(): Promise<boolean> {
    return true; // Always available as it's built-in
  }

  // Override install method since no installation is needed
  async install(): Promise<any> {
    return { success: true };
  }

  // Override uninstall method since it can't be uninstalled
  async uninstall(): Promise<any> {
    return { success: true };
  }
} 