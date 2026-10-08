// cPanel Node.js Application Startup File
// Compatible with both Apache+Passenger and LiteSpeed (lsnode)
const http = require("http");
const socketPath = process.env.LSNODE_SOCKET;

if (socketPath) {
  const originalListen = http.Server.prototype.listen;
  http.Server.prototype.listen = function (...args) {
    const callback = args.find((a) => typeof a === "function");
    return originalListen.call(this, socketPath, callback);
  };
}

process.env.PORT = process.env.PORT || 3000;
require("./.next/standalone/server.js");
