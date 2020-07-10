# IPdrop
[<img src='https://raw.githubusercontent.com/scheng123/IPdrop/master/public/images/logo.png'>](https://ipdrop-sc.herokuapp.com)

## Project submission

This project is a submission for [HackTheLib](https://www.hackthelib.com).

Video submission: [IPdrop presentation](https://raw.githubusercontent.com/scheng123/IPdrop/master/IPdrop_presentation.mp4)

Target categories: Most Practical; Best Design

The live application can be found here: [IPdrop](https://ipdrop-sc.herokuapp.com)

## Introduction

When was the last time you had to transfer a file from a device to another device connected to the same network? Did you use Google Drive? Dropbox? AirDrop, then realize you're transfering the file from an iPhone to an Android? What about big files? Did you have to wait for transfers for both uploading and downloading?

Meet IPdrop. This web app will cut your uploading and downloading waits in half, by combining the upload download process altogether. It will also instantly show all the users connected to your network that is ready for file receiving, eliminating the requirement of sharing links and copy pasting.

## Combining the upload download process

Node.js's pipe streams are usually for streaming the upload user's data stream to a file on the server using `request.pipe(fs.createWriteStream(filename))` or streaming from a file on the server to a download user using `fs.createReadStream(filename).pipe(response)`. Taking advantage of Node.js's pipe streams' versatility, it turns out that piping the upload user's `request` to the download user's `response` actually works! While the upload user is uploading, the download user can download at the same time, resulting in a process where the total transfer time is cut down by half:
```
Assume upload speed = download speed

Without piping directly, it takes two hours:
1. Upload user starts uploading. Takes one hour to upload
2. Download user has to wait for upload user to finish
3. After one hour, download user can start downloading
4. After one hour, transfer is complete

With piping directly, it takes one hour:
1. Upload user starts uploading. Takes one hour to upload
2. Download user starts downloading from upload user
3. After one hour, transfer is complete
```

A demo of this process can be found in the project root directory with a file called `concept.js`.

## Running your own IPdrop

It's fairly simple:

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

If you do not want to use Heroku to deploy, run this app behind a reverse proxy like nginx that controls the `x-forwarded-for` header. 

If you do use nginx, remember to disable buffering by setting `proxy_request_buffering off` and increase the max upload size by setting `client_max_body_size 100G`. Don't worry about setting the max upload size to a high number as the uploading should be streamed; therefore, memory won't increase.

## Contributing
Any pull requests will be gladly accepted and reviewed (this is after the hackathon).

If anyone is willing to sponsor the domain name ipdrop.io open an issue regarding this. Thanks!

## Ending notes
This software is released under GNU General Public License version 3. A copy of this license is available in the repository's root directory with a file named "LICENSE."

As always, made with love,<br>
Simon Cheng