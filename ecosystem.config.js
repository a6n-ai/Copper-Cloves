/**
 * PM2 process config. The web app is typically started separately (next start);
 * this defines the long-running scheduler that acts as the app's own cron for
 * time-based class emails (member reminders + instructor rosters).
 *
 *   pm2 start ecosystem.config.js
 *
 * Requires env to be available (DATABASE_URL, EMAIL_*/RESEND_*, NEXTAUTH_URL).
 */
module.exports = {
  apps: [
    {
      name: "cc-class-email-scheduler",
      script: "node_modules/.bin/tsx",
      args: "scripts/scheduler.ts",
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      env: { NODE_ENV: "production" },
    },
  ],
};
