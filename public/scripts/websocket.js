function pathToWebSocket(path){
    var l = window.location;
    var websocket_url;
    if (l.protocol === "https:") {
        websocket_url = "wss:";
    } else {
        websocket_url = "ws:";
    }
    websocket_url += "//" + l.host + path;
    return websocket_url;
}

function addToDomList(nameID){
    var row = document.createElement('div');
    row.className = 'main-list-row';
    row.setAttribute('nameid', nameID);

    var name = document.createElement('span');
    name.className = 'name';
    name.textContent = nameID;

    var div_btn = document.createElement('div');
    div_btn.className = 'upload-btn';

    var img = document.createElement('img');
    img.className = 'upload-icon';
    img.src = '/images/upload-icon.png';

    var input_file = document.createElement('input');
    input_file.type = 'file';
    input_file.onchange = window.uploadHandler;

    div_btn.appendChild(img);
    div_btn.appendChild(input_file);

    row.appendChild(name);
    row.appendChild(div_btn);
    document.getElementById('main-list').appendChild(row);
}
function removeFromDomList(nameID){
    var target = document.querySelector(`[nameid="${nameID}"]`);
    if(target) target.parentNode.removeChild(target);
}

function connect(){
    if(window.ws && (window.ws.readyState === window.ws.OPEN || window.ws.readyState === window.ws.CONNECTING)) return;
    window.ws = new WebSocket(pathToWebSocket('/'));
    var heartbeat_interval = -1;
    var connection_name = document.getElementById('connection-name');
    var connection_ip = document.getElementById('connection-ip');
    var connection_status = document.getElementById('connection-status');
    var reconnect_btn = document.getElementById('reconnect-btn');
    var main_list = document.getElementById('main-list');

    connection_status.textContent = 'Connection: Connecting';
    main_list.className = 'disabled';
    reconnect_btn.hidden = true;
    window.ws.onopen = function(){
        connection_status.textContent = 'Connection: Connected';
        main_list.className = '';
        reconnect_btn.hidden = true;
        heartbeat_interval = setInterval(()=>window.ws.send(JSON.stringify({
            type: 'HEARTBEAT'
        })), 2000);
    };
    window.ws.onerror = function(){
        window.ws.close();
    };
    window.ws.onclose = function(){
        connection_status.textContent = 'Connection: Disconnected';
        main_list.className = 'disabled';
        reconnect_btn.hidden = false;
        clearInterval(heartbeat_interval);
    };
    window.ws.onmessage = function(message){
        var parsed = JSON.parse(message.data);
        if(parsed.type !== 'HEARTBEAT') console.log(parsed);
        switch(parsed.type){
            case 'INIT':
                connection_name.textContent = 'Name: '+parsed.name;
                connection_ip.textContent = 'IP: '+parsed.ip;

                // clean dom list //
                var dom_client_list = document.getElementsByClassName('main-list-row');
                while(dom_client_list[0]) dom_client_list[0].parentNode.removeChild(dom_client_list[0]);

                // add existing clients to dom list //
                for(let each_client of parsed.allClients){
                    addToDomList(each_client);
                }
                break;
            case 'DELETE':
                removeFromDomList(parsed.name);
                break;
            case 'ADD':
                addToDomList(parsed.name);
                break;
            case 'REQUEST':
                var askBox = bootbox.confirm(`${parsed.name} wants to share "${parsed.filename}". Do you want to receive it?`, function(answer){
                    window.ws.send(JSON.stringify({
                        type: 'RESPONSE',
                        name: parsed.name,
                        accept: answer
                    }));
                    if(answer){
                        window.capture_transfer_receive = function(parsed){
                            var iframe = document.createElement('iframe');
                            iframe.src = '/download?hash='+parsed.hash;
                            iframe.style.display = 'none';
                            iframe.onload = function(){document.body.removeChild(iframe)};
                            document.body.appendChild(iframe);
                            window.capture_transfer_receive = null;
                        }
                    }
                });
                setTimeout(()=>askBox.modal('hide'), 10000);
                break;
            case 'RESPONSE':
                if(window.capture_response) window.capture_response(parsed);
                break;
            case 'TRANSFER':
                if(parsed.action === 'STARTSEND'){
                    if(window.capture_transfer_send) window.capture_transfer_send(parsed);
                }else if(parsed.action === 'STARTRECEIVE'){
                    if(window.capture_transfer_receive){
                        var didCallback = false;
                        var wait_download_box = bootbox.dialog({message: `<div class="text-center"><i class="fa fa-spin fa-spinner"></i>Waiting for ${parsed.name} to begin upload</div>`, closeButton: false});
                        var interval_id = setInterval(async function(){
                            var response = await (await fetch('/downloadstatus?hash='+parsed.hash)).text();
                            if(!didCallback){
                                switch(response){
                                    case 'go':
                                        wait_download_box.modal('hide');
                                        bootbox.alert('Started download');
                                        didCallback = true;
                                        clearInterval(interval_id);
                                        window.capture_transfer_receive(parsed);
                                        break;
                                    case 'wait':
                                        break;
                                    default:
                                        wait_download_box.modal('hide');
                                        bootbox.alert('Uploader took too long to respond.');
                                        didCallback = true;
                                        clearInterval(interval_id);
                                        window.capture_transfer_receive = null;
                                }
                            }
                        }, 10);
                    }
                }
        }
    };
}

window.addEventListener('load', connect);