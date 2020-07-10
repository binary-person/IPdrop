/**
 * This is a proof of concept that is capable of directly streaming
 * the user's upload to another user's download directly, without
 * requiring the server to store the user's files (except the 2MiB buffer).
 * This method is implemented in IPdrop; this here is just showcasing
 * the awesomeness of Node.js's streams
 * 
 * Instructions on how to use:
 * 1. Go to http://ip:8888/
 * 2. Upload a file
 * 3. While the upload page is waiting, go to http://ip:8888/download
 * 4. The upload page should directly upload to the download page
 * (if that makes sense)
 */

var app = require('express')();
var busboy = require('connect-busboy');

var global_file_pipe;
var global_filename;

app.use(busboy({
    highWaterMark: 2 * 1024 * 1024 // 2MebiByte stream buffer; Go Mebi.. jk
}));

app.get('/', function(_req, res){
    res.send(`
<html>
    <body>
        <form encType='multipart/form-data' action='/upload' method='post'>
            <input type='file' name="uploadFile"/>
            <button type='submit'>Upload</button>
        </form>
    </body>
</html>`);
});
app.get('/download', function(_req, res){
    if(global_file_pipe){
        res.redirect('/download/'+global_filename);
    }else{
        res.send("User hasn't uploaded yet");
    }
});
app.get('/download/*', function(req, res){
    var fileName = req.path.replace(/^\/download\//, '');
    if(global_filename && fileName === global_filename){
        res.setHeader('Content-Disposition', 'attachment');
        global_file_pipe.pipe(res);
        res.on('close', function(){
            global_file_pipe.emit('end');
            // I know you shouldn't do that but trust me,
            // I tried pipe.destroy/end/close/resume/you name it //
        });
    }else{
        res.send('Invalid request');
    }
});
app.post('/upload', function(req, res){
    req.pipe(req.busboy);
    req.busboy.on('file', (_fieldname, file, filename) => {
        console.log('Start upload of '+filename);

        // file upload stream //
        global_file_pipe = file;

        // filename //
        global_filename = filename;
        
        // handle finished upload //
        global_file_pipe.on('end', function(){
            global_file_pipe = undefined;
            global_filename = undefined;
            console.log('Finished upload/download of '+filename);
            req.unpipe(); // in case the user ended the download
            res.send('Finished');
        })
    });
});

app.listen(8888, null, null, ()=>console.log('Concept piping listening at 8888'));