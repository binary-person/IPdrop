const http = require('http');
const routing = require('./routing.js');
const websocket_handler = require('./websocket-handler.js');
const Clients = require('./Clients.js');

const binding_address = '0.0.0.0';
const port = process.env.PORT || 8080;

/**
 * upload_download_hashes; used to track who can upload/download to/from who and
 * used to store the req/res piping variables
 * {
 *     "big-fat-hash": {
 *         file_pipe: Stream,
 *         file_name: "MyBankAccount.txt",
 *         file_size: 1024,
 *         lock_download: false, // prevent downloading twice,
 *         lock_upload: false, // prevent uploading twice
 *         callback: function(){} // for cleaning up memory after it's finished
 *     },...
 * }
 */
var upload_download_hashes = {};

const clients = new Clients();
const server = http.createServer(routing(upload_download_hashes));
websocket_handler(server, clients, upload_download_hashes);

server.listen(port, binding_address, null,
    ()=>console.log(`IPdrop listening at http://${binding_address}:${port}`));