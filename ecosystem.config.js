module.exports = {
  apps: [
    {
      name: "meetsync",
      script: "./app/server.js",
      cwd: "/home/gspe/meetsync",
      env_file: "/home/gspe/meetsync/.env",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
      },
      // Auto-restart on crash, max 5x in 60s before stop
      max_restarts: 5,
      min_uptime: "10s",
      restart_delay: 2000,
      // Logs
      out_file: "/home/gspe/meetsync/logs/out.log",
      error_file: "/home/gspe/meetsync/logs/error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
