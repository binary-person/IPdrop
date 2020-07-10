// make it global so websocket.js can reference it
window.uploadHandler = function(event){
    if(event.target.files.length && window.ws.readyState === window.ws.OPEN){
        var name = event.target.parentNode.parentNode.getAttribute('nameid');
        window.ws.send(JSON.stringify({
            type: 'REQUEST',
            name,
            filename: event.target.files[0].name,
            size: event.target.files[0].size
        }));
        var wait_box = bootbox.dialog({
            message: `<div class="text-center"><i class="fa fa-spin fa-spinner"></i>Waiting for ${name} to respond</div>`,
            closeButton: false
        });
        var timeout_id = setTimeout(function(){
            wait_box.modal('hide');
            window.capture_response = null;
            event.target.value = '';
            bootbox.alert(name+' took too long to respond');
        }, 10000);
        // method is kind of garbage but it is the only thing I can think of
        // within the time limit that I have //
        window.capture_response = function(parsed){
            clearTimeout(timeout_id);
            wait_box.modal('hide');
            if(parsed.success){
                // begin transfer //
                // same garbage method //
                window.capture_transfer_send = function(parsed){
                    var progress_box = bootbox.dialog({
                        message: `<div class="text-center"><i class="fa fa-spin fa-spinner"></i><div class="progress"><div class="progress-bar" style="width: 0%;"></div></div>Uploading</div>`,
                        closeButton: false
                    });

                    var form = new FormData();
                    form.append('fileUpload', event.target.files[0]);

                    var request = new XMLHttpRequest();
                    request.upload.addEventListener('progress', function(upload_event){
                        document.querySelector('.progress-bar').style.width = (100*upload_event.loaded / upload_event.total).toFixed(2)+'%';
                    });
                    request.addEventListener('load', function() {
                        if(request.status !== 200){
                            progress_box.modal('hide');
                            bootbox.alert('Something went wrong uploading: '+request.response);
                        }else{
                            progress_box.modal('hide');
                            bootbox.alert(`Uploaded ${event.target.files[0].name} to ${parsed.name}`);
                        }
                    });
                    request.open('POST', '/upload?hash='+parsed.hash);
                    request.send(form);

                    window.capture_transfer_send = null;
                };
            }else{
                event.target.value = '';
                bootbox.alert(name+' declined to accept your file');
            }
            window.capture_response = null;
        };
    }
};