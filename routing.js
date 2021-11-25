const busboy = require('connect-busboy');
const cookie_parser = require('cookie-parser');
const express = require('express');
const app = express();

const public_folder = __dirname+'/public';

module.exports = function(upload_download_hashes){
    app.use(express.static(public_folder));
    app.use(busboy({
        highWaterMark: 2 * 1024 * 1024 // 2MiB buffer
    }));
    app.use(cookie_parser());
    app.post('/upload', function(req, res) {
        if(upload_download_hashes[req.query.hash] && !upload_download_hashes[req.query.hash].lock_upload){
            upload_download_hashes[req.query.hash].lock_upload = true;
            req.pipe(req.busboy);
            req.busboy.on('file', function(_fieldname, file, filename){
                upload_download_hashes[req.query.hash].file_pipe = file;
                upload_download_hashes[req.query.hash].file_name = filename;

                file.on('end', function(){
                    req.unpipe();
                    res.send('Uploaded');
                    if(upload_download_hashes[req.query.hash]) upload_download_hashes[req.query.hash].callback();
                });
            });
        }else{
            res.send('Invalid request'); // nobody to handle this lol
        }
    });
    app.get('/downloadstatus', function(req, res){
        if(upload_download_hashes[req.query.hash]){
            if(upload_download_hashes[req.query.hash].file_pipe){
                res.send('go');
            }else{
                res.send('wait');
            }
        }else{
            res.send('nonexistant');
        }
    });
    app.get('/download', function(req, res) {
        if(upload_download_hashes[req.query.hash] && upload_download_hashes[req.query.hash].file_pipe){
            res.cookie('hash', req.query.hash, {maxAge: 10000, sameSite: 'None', secure: true});
            res.redirect('/download/'+upload_download_hashes[req.query.hash].file_name);
        }else{
            res.send('Invalid request'); // nobody to handle this lol
        }
    });
    app.get('/download/*', function(req, res) {
        var hash = req.cookies.hash;
        if(hash && upload_download_hashes[hash] && !upload_download_hashes[hash].lock_download){
            upload_download_hashes[hash].lock_download = true;
            res.setHeader('Content-Disposition', 'attachment');
            res.setHeader('Content-Length', upload_download_hashes[hash].file_size);
            upload_download_hashes[hash].file_pipe.pipe(res);
            res.on('close', function(){
                if(upload_download_hashes[hash] && upload_download_hashes[hash].file_pipe)
                upload_download_hashes[hash].file_pipe.emit('end');
            });
        }else{
            res.send('Invalid request');
        }
    });
    return app;
}
