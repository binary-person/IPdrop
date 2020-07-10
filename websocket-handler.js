const WebSocket = require('ws');
const md5 = require('md5');

module.exports = function(server, clients, upload_download_hashes){
    const wss = new WebSocket.Server({ server });

    /**
     * request_response, used for tracking who requested who to upload files to
     * {
     *     "127.0.0.1":{
     *         "Big Blue Fish": [{
     *             recipient: "Smart Gray Wolf"
     *             callback: function(success){handle_here},
     *             timeout: timeout_id
     *         }, ...more requests]
     *     }
     * }
     */
    var request_response = {};
    // since there's so many instances where we clean
    // to prevent memory leaks, here's a function for it //
    function clean_request_response(ip, name, index){
        if(!isNaN(index)) request_response[ip][name].splice(index, 1);
        if(!request_response[ip][name].length) delete request_response[ip][name];
        if(!Object.keys(request_response[ip]).length) delete request_response[ip];
    }
    
    wss.on('connection', async function(client_ws, client_req){
        // big security issue if you don't put this behind a reverse proxy like nginx/heroku
        // that controls the "x-forwarded-for" header //
        const ip = client_req.headers["x-forwarded-for"].split(',').pop();
        const name = await clients.addClient(ip, client_ws);
        
        client_ws.on('message', function(message){
            var parsed = JSON.parse(message);
            switch(parsed.type){
                case 'HEARTBEAT': // send a ping pong
                    client_ws.send(JSON.stringify({
                        type: 'HEARTBEAT'
                    }));
                    break;
                case 'REQUEST': // when the client asks to send a file to another client
                    const ip_clients = clients.getClientsByIP(ip);
                    if(ip_clients.includes(parsed.name) && parsed.name !== name){ // existance validation
                        // check if request to the same client from same sender is a duplicate
                        // ignore if duplicate //
                        if(request_response[ip] && request_response[ip][name]){
                            for(let each_request of request_response[ip][name]){
                                if(each_request.recipient === parsed.name) return; // nah bruh
                            }
                        }

                        clients.getClient(ip, parsed.name).send(JSON.stringify({
                            type: 'REQUEST',
                            name,
                            filename: parsed.filename,
                            size: parsed.size
                        }));
                        
                        if(!request_response[ip]) request_response[ip] = {};
                        if(!request_response[ip][name]) request_response[ip][name] = [];
                        
                        const index = request_response[ip][name].push({
                            recipient: parsed.name,
                            callback: function(success){
                                if(success){
                                    clearTimeout(request_response[ip][name][index].timeout);
                                    // now we send hashes and msgs to connect the data stream //
                                    // first, create the hash //
                                    // This must have a -200% chance of collision and no chance of bruting the hash //
                                    const hash = md5(name+parsed.name+Date.now()+Math.random()+Math.random());
                                    upload_download_hashes[hash] = {
                                        lock_upload: false,
                                        lock_download: false,
                                        file_size: parsed.size,
                                        callback: function(){
                                            clean_request_response(ip, name, index);
                                            delete upload_download_hashes[hash];
                                        }
                                    };

                                    clients.getClient(ip, parsed.name).send(JSON.stringify({
                                        type: 'TRANSFER',
                                        name,
                                        action: 'STARTRECEIVE',
                                        hash,
                                        filename: parsed.filename,
                                        size: parsed.size
                                    }));

                                    client_ws.send(JSON.stringify({
                                        type: 'RESPONSE',
                                        success: true,
                                        name: parsed.name
                                    }));
                                    client_ws.send(JSON.stringify({
                                        type: 'TRANSFER',
                                        name: parsed.name,
                                        action: 'STARTSEND',
                                        hash
                                    }));

                                    // if the sender/receiver doesn't start sending/downloading
                                    // within 10 seconds, terminate to prevent a memory leak //
                                    setTimeout(function(){
                                        if(upload_download_hashes[hash] &&
                                        (!upload_download_hashes[hash].lock_upload ||
                                        !upload_download_hashes[hash].lock_download)){
                                            // quietly invalidate the hash since this should never happen //
                                            upload_download_hashes[hash].callback();
                                        }
                                    }, 10000);
                                }else{
                                    clearTimeout(request_response[ip][name][index].timeout);
                                    clean_request_response(ip, name, index);
                                    client_ws.send(JSON.stringify({
                                        type: 'RESPONSE',
                                        success: false,
                                        name: parsed.name
                                    }));
                                }
                            }
                        }) - 1;

                        // wait a 10 second window before failing the request (avoid memory leak) //
                        request_response[ip][name][index].timeout = setTimeout(()=>request_response[ip][name][index].callback(false), 10000);
                    }
                    break;
                case 'RESPONSE':
                    // validate if sender exists (never trust client data) //
                    if(request_response[ip] && request_response[ip][parsed.name]){
                        for(let each_request of request_response[ip][parsed.name]){
                            if(each_request.recipient === name){
                                each_request.callback(parsed.accept);
                                return;
                            }
                        }
                    }

                    // if sender doesn't exist, send a message to the client //
                    client_ws.send(JSON.stringify({
                        type: 'TRANSFER',
                        name: parsed.name,
                        action: 'NAME_ERROR'
                    }));
            }
        });
        client_ws.on('close', function(){
            clients.removeClient(ip, name);

            // let all clients with the same IP know one of them got disconnected //
            for(let each_client of clients.getClientsByIP(ip)){
                clients.getClient(ip, each_client).send(JSON.stringify({
                    type: 'DELETE',
                    name
                }));
            }

            // remove pending requests //
            if(request_response[ip] && request_response[ip][name]){
                for(let count = 0; count < request_response[ip][name].length; count++){
                    clearTimeout(request_response[ip][name][count].timeout);
                }
                delete request_response[ip][name];
                if(!Object.keys(request_response[ip]).length) delete request_response[ip];
            }

            // if any recipient is this closed client, emit a fail to the sender
            if(request_response[ip]){
                for(let each_client in request_response[ip]){
                    for(let each_request of request_response[ip][each_client]){
                        if(each_request.recipient === name){
                            each_request.callback(false);
                        }
                    }
                }
            }
        });

        // let all clients (except the current one) with the same IP know one of them got added //
        for(let each_client of clients.getClientsByIP(ip)){
            if(each_client === name) continue;
            clients.getClient(ip, each_client).send(JSON.stringify({
                type: 'ADD',
                name
            }));
        }
        
        client_ws.send(JSON.stringify({
            type: 'INIT',
            name,
            ip,
            allClients: clients.getClientsByIP(ip, name)
        }));
    });
}