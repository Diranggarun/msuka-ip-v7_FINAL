// PM2 process file — keeps the server running and restarts it if it crashes.
// Start with `npm run pm2:start` (uses env_production). See docs/guides/DEPLOYMENT.md.
module.exports = {
  apps: [{
    name: 'msukaip',                         // name shown in `pm2 status` / used by pm2 stop|restart
    script: 'backend/server.js',             // same entry point as `npm start`
    cwd: __dirname,                          // run from msuka-ip-v7/ so .env, certs/, backups/ resolve
    instances: 1,                            // one process: Socket.IO rooms and the SQLite file live in it
    exec_mode: 'fork',                       // plain node process (cluster mode would split Socket.IO)
    autorestart: true,                       // restart automatically after a crash
    max_restarts: 10,                        // give up after 10 quick crashes in a row (crash loop)
    min_uptime: '30s',                       // a run shorter than this counts as a crash for max_restarts
    restart_delay: 5000,                     // wait 5 s before each restart (lets ports/files free up)
    max_memory_restart: '500M',              // restart if memory grows past 500 MB (leak guard)
    kill_timeout: 5000,                      // give the server 5 s to close before force-kill
    watch: false,                            // never auto-restart on file edits in production
    out_file: 'logs/out.log',                // console.log output
    error_file: 'logs/error.log',            // console.error output
    time: true,                              // prefix each log line with a timestamp
    env: { NODE_ENV: 'production' },            // even a bare `pm2 start` runs production — dev mode would reset the demo passwords
    env_production: { NODE_ENV: 'production' }, // `--env production`: real secrets from .env required
  }],
};
