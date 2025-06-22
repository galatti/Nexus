#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

interface PomodoroState {
  isRunning: boolean;
  sessionType: 'work' | 'short-break' | 'long-break';
  remainingTime: number; // in seconds
  sessionCount: number;
  startTime?: Date;
  stats: {
    workSessionsCompleted: number;
    totalWorkTime: number; // in minutes
    breaksTaken: number;
    totalBreakTime: number; // in minutes
  };
}

class PomodoroServer {
  private server: Server;
  private state: PomodoroState;
  private timer: NodeJS.Timeout | null = null;
  private config: {
    workDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
    longBreakInterval: number;
    notifications: boolean;
    autoStart: boolean;
  };

  constructor() {
    this.config = {
      workDuration: parseInt(process.env.POMODORO_WORK_DURATION || '25'),
      shortBreakDuration: parseInt(process.env.POMODORO_SHORT_BREAK_DURATION || '5'),
      longBreakDuration: parseInt(process.env.POMODORO_LONG_BREAK_DURATION || '15'),
      longBreakInterval: parseInt(process.env.POMODORO_LONG_BREAK_INTERVAL || '4'),
      notifications: process.env.POMODORO_NOTIFICATIONS !== 'false',
      autoStart: process.env.POMODORO_AUTO_START === 'true'
    };

    this.state = {
      isRunning: false,
      sessionType: 'work',
      remainingTime: this.config.workDuration * 60,
      sessionCount: 0,
      stats: {
        workSessionsCompleted: 0,
        totalWorkTime: 0,
        breaksTaken: 0,
        totalBreakTime: 0
      }
    };

    this.server = new Server({
      name: 'pomodoro-timer',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'start_timer',
            description: 'Start a Pomodoro timer session',
            inputSchema: {
              type: 'object',
              properties: {
                sessionType: {
                  type: 'string',
                  enum: ['work', 'short-break', 'long-break'],
                  description: 'Type of session to start',
                  default: 'work'
                },
                duration: {
                  type: 'number',
                  description: 'Custom duration in minutes (optional)',
                  minimum: 1,
                  maximum: 120
                }
              }
            }
          },
          {
            name: 'stop_timer',
            description: 'Stop the current timer session',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'pause_timer',
            description: 'Pause or resume the current timer',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'get_status',
            description: 'Get current timer status and remaining time',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'get_stats',
            description: 'Get productivity statistics',
            inputSchema: {
              type: 'object',
              properties: {
                period: {
                  type: 'string',
                  enum: ['today', 'session'],
                  description: 'Statistics period',
                  default: 'session'
                }
              }
            }
          },
          {
            name: 'reset_timer',
            description: 'Reset the current timer session',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'configure_timer',
            description: 'Update timer configuration',
            inputSchema: {
              type: 'object',
              properties: {
                workDuration: {
                  type: 'number',
                  description: 'Work session duration in minutes',
                  minimum: 1,
                  maximum: 120
                },
                shortBreakDuration: {
                  type: 'number',
                  description: 'Short break duration in minutes',
                  minimum: 1,
                  maximum: 60
                },
                longBreakDuration: {
                  type: 'number',
                  description: 'Long break duration in minutes',
                  minimum: 1,
                  maximum: 120
                },
                longBreakInterval: {
                  type: 'number',
                  description: 'Work sessions before long break',
                  minimum: 2,
                  maximum: 10
                }
              }
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'start_timer':
            return await this.startTimer(args as any);
          case 'stop_timer':
            return await this.stopTimer();
          case 'pause_timer':
            return await this.pauseTimer();
          case 'get_status':
            return await this.getStatus();
          case 'get_stats':
            return await this.getStats(args as any);
          case 'reset_timer':
            return await this.resetTimer();
          case 'configure_timer':
            return await this.configureTimer(args as any);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    });
  }

  private async startTimer(args: { sessionType?: string; duration?: number }) {
    if (this.state.isRunning) {
      return {
        content: [{
          type: 'text',
          text: 'Timer is already running. Use pause_timer to pause or stop_timer to stop.'
        }]
      };
    }

    const sessionType = args.sessionType as 'work' | 'short-break' | 'long-break' || 'work';
    let duration: number;

    if (args.duration) {
      duration = args.duration * 60; // Convert to seconds
    } else {
      switch (sessionType) {
        case 'work':
          duration = this.config.workDuration * 60;
          break;
        case 'short-break':
          duration = this.config.shortBreakDuration * 60;
          break;
        case 'long-break':
          duration = this.config.longBreakDuration * 60;
          break;
        default:
          duration = this.config.workDuration * 60;
      }
    }

    this.state = {
      ...this.state,
      isRunning: true,
      sessionType,
      remainingTime: duration,
      startTime: new Date()
    };

    this.startCountdown();

    const sessionName = sessionType.replace('-', ' ');
    const durationMin = Math.round(duration / 60);

    return {
      content: [{
        type: 'text',
        text: `🍅 Started ${sessionName} session for ${durationMin} minutes. Stay focused!`
      }]
    };
  }

  private async stopTimer() {
    if (!this.state.isRunning) {
      return {
        content: [{
          type: 'text',
          text: 'No timer is currently running.'
        }]
      };
    }

    this.clearTimer();
    
    // Update stats if session was work session
    if (this.state.sessionType === 'work' && this.state.startTime) {
      const elapsedMinutes = Math.round((Date.now() - this.state.startTime.getTime()) / 60000);
      this.state.stats.totalWorkTime += elapsedMinutes;
    }

    this.state.isRunning = false;
    this.state.startTime = undefined;

    return {
      content: [{
        type: 'text',
        text: '⏹️ Timer stopped. Take a moment to reflect on your progress.'
      }]
    };
  }

  private async pauseTimer() {
    if (!this.state.isRunning) {
      return {
        content: [{
          type: 'text',
          text: 'No timer is currently running to pause.'
        }]
      };
    }

    this.clearTimer();
    this.state.isRunning = false;

    return {
      content: [{
        type: 'text',
        text: `⏸️ Timer paused with ${this.formatTime(this.state.remainingTime)} remaining. Use start_timer to resume.`
      }]
    };
  }

  private async getStatus() {
    const remainingTimeFormatted = this.formatTime(this.state.remainingTime);
    const sessionName = this.state.sessionType.replace('-', ' ');
    
    if (this.state.isRunning) {
      return {
        content: [{
          type: 'text',
          text: `🍅 ${sessionName.toUpperCase()} session in progress\n⏰ Time remaining: ${remainingTimeFormatted}\n📊 Session count: ${this.state.sessionCount}`
        }]
      };
    } else {
      return {
        content: [{
          type: 'text',
          text: `⏸️ Timer is paused\n🎯 Next session: ${sessionName}\n⏰ Time set: ${remainingTimeFormatted}\n📊 Session count: ${this.state.sessionCount}`
        }]
      };
    }
  }

  private async getStats(args: { period?: string }) {
    const { stats } = this.state;
    const period = args.period || 'session';

    let statsText = '';
    
    if (period === 'session') {
      statsText = `📈 Pomodoro Statistics (Current Session)
🍅 Work sessions completed: ${stats.workSessionsCompleted}
⏰ Total work time: ${stats.totalWorkTime} minutes
☕ Breaks taken: ${stats.breaksTaken}
🧘 Total break time: ${stats.totalBreakTime} minutes
🎯 Current session count: ${this.state.sessionCount}`;
    } else {
      // For 'today' period, we'd need to persist data - for now, same as session
      statsText = `📈 Pomodoro Statistics (Today)
🍅 Work sessions completed: ${stats.workSessionsCompleted}
⏰ Total work time: ${stats.totalWorkTime} minutes
☕ Breaks taken: ${stats.breaksTaken}
🧘 Total break time: ${stats.totalBreakTime} minutes`;
    }

    return {
      content: [{
        type: 'text',
        text: statsText
      }]
    };
  }

  private async resetTimer() {
    this.clearTimer();
    
    this.state = {
      ...this.state,
      isRunning: false,
      remainingTime: this.config.workDuration * 60,
      sessionType: 'work',
      startTime: undefined
    };

    return {
      content: [{
        type: 'text',
        text: '🔄 Timer reset to work session. Ready to start when you are!'
      }]
    };
  }

  private async configureTimer(args: any) {
    const updates: string[] = [];

    if (args.workDuration) {
      this.config.workDuration = args.workDuration;
      updates.push(`Work duration: ${args.workDuration} minutes`);
    }

    if (args.shortBreakDuration) {
      this.config.shortBreakDuration = args.shortBreakDuration;
      updates.push(`Short break: ${args.shortBreakDuration} minutes`);
    }

    if (args.longBreakDuration) {
      this.config.longBreakDuration = args.longBreakDuration;
      updates.push(`Long break: ${args.longBreakDuration} minutes`);
    }

    if (args.longBreakInterval) {
      this.config.longBreakInterval = args.longBreakInterval;
      updates.push(`Long break interval: ${args.longBreakInterval} sessions`);
    }

    // Reset current timer if not running
    if (!this.state.isRunning) {
      this.state.remainingTime = this.config.workDuration * 60;
    }

    return {
      content: [{
        type: 'text',
        text: `⚙️ Timer configuration updated:\n${updates.join('\n')}`
      }]
    };
  }

  private startCountdown(): void {
    this.timer = setInterval(() => {
      this.state.remainingTime--;

      if (this.state.remainingTime <= 0) {
        this.onTimerComplete();
      }
    }, 1000);
  }

  private onTimerComplete(): void {
    this.clearTimer();
    this.state.isRunning = false;

    // Update statistics and session count
    if (this.state.sessionType === 'work') {
      this.state.stats.workSessionsCompleted++;
      this.state.stats.totalWorkTime += this.config.workDuration;
      this.state.sessionCount++;
    } else {
      this.state.stats.breaksTaken++;
      if (this.state.sessionType === 'short-break') {
        this.state.stats.totalBreakTime += this.config.shortBreakDuration;
      } else {
        this.state.stats.totalBreakTime += this.config.longBreakDuration;
      }
    }

    // Determine next session type
    let nextSessionType: 'work' | 'short-break' | 'long-break';
    let nextDuration: number;

    if (this.state.sessionType === 'work') {
      // After work, determine break type
      if (this.state.sessionCount % this.config.longBreakInterval === 0) {
        nextSessionType = 'long-break';
        nextDuration = this.config.longBreakDuration * 60;
      } else {
        nextSessionType = 'short-break';
        nextDuration = this.config.shortBreakDuration * 60;
      }
    } else {
      // After break, back to work
      nextSessionType = 'work';
      nextDuration = this.config.workDuration * 60;
    }

    this.state.sessionType = nextSessionType;
    this.state.remainingTime = nextDuration;

    // Auto-start next session if configured
    if (this.config.autoStart) {
      this.state.isRunning = true;
      this.state.startTime = new Date();
      this.startCountdown();
    }
  }

  private clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Pomodoro Timer MCP server running on stdio');
  }
}

// Start the server
const pomodoroServer = new PomodoroServer();
pomodoroServer.run().catch(console.error); 