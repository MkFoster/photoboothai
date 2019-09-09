const video = document.querySelector('.player');
const canvas = document.querySelector('.monitor');
const landingScreen = document.querySelector('#landing-screen');
const cameraScreen = document.querySelector('#camera-screen')
const title = document.querySelector('.title');
const overview = document.querySelector('.overview');
const ctx = canvas.getContext('2d');
const strip = document.querySelector('.strip');
const analyzeImageEndpoint = `https://photobooth-azure-func-app.azurewebsites.net/api/analyzeimage?code=VU/BNWwdqjIXVqiQlfiFP/pZKJeZsq9EHKhQvHL6XSpKYa6T1gUy7w==`;
const okButton = document.querySelector('#ok');
const noButton = document.querySelector('#no');
const shutterButton = document.querySelector('#shutter-button');
const status = document.querySelector('#status');
let faceData;
let currentEmotion;
let faceOutlines;
let vidInterval;
let paintInterval;

window.AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
let sound; //generated audio buffer

video.addEventListener('canplay', paintToCanvas);

video.addEventListener('play', () => {
    //vidInterval = setInterval(detectFaces, 4000);
});

video.addEventListener('ended', () => {
    //clearInterval(vidInterval);
});

okButton.addEventListener('click', getVideo);
noButton.addEventListener('click', () => window.location = 'https://www.unsplash.com');
shutterButton.addEventListener('click', takePhoto);

/*
function detectFaces() {
    // use the face detection library to find the face
    faceOutlines = ccv.detect_objects({
        "canvas": (ccv.pre(canvas)),
        "cascade": cascade,
        "interval": 5,
        "min_neighbors": 1
    });
    if (faceOutlines.length > 0) {
        takePhoto();
    }
}*/

function drawRectangle(rectangle, color, lineWidth) {
    let boundingPoints = {};
    boundingPoints.topLeftX = rectangle.left;
    boundingPoints.topLeftY = rectangle.top;

    boundingPoints.topRightX = rectangle.left + rectangle.width;
    boundingPoints.topRightY = rectangle.top;

    boundingPoints.bottomLeftX = rectangle.left;
    boundingPoints.bottomLeftY = rectangle.top + rectangle.height;

    boundingPoints.bottomRightX = rectangle.left + rectangle.width;
    boundingPoints.bottomRightY = rectangle.top + rectangle.height;

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;

    /*
    console.log(boundingPoints.topLeftX, )
    console.log(boundingPoints.topLeftX, boundingPoints.topLeftY);
    console.log(boundingPoints.topRightX, boundingPoints.topRightY);
    console.log(boundingPoints.bottomRightX, boundingPoints.bottomRightY);
    console.log(boundingPoints.bottomLeftX, boundingPoints.bottomRightY);
    console.log(boundingPoints.topLeftX, boundingPoints.topRightY);*/

    // !Important Note: If you don't use ctx.beginPath() and ctx.closePath() stroke color and width on 
    // previously drawn lines will be changed to the last new line style
    ctx.beginPath();
    ctx.moveTo(boundingPoints.topLeftX, boundingPoints.topLeftY);
    ctx.lineTo(boundingPoints.topRightX, boundingPoints.topRightY);
    ctx.lineTo(boundingPoints.bottomRightX, boundingPoints.bottomRightY);
    ctx.lineTo(boundingPoints.bottomLeftX, boundingPoints.bottomRightY);
    ctx.lineTo(boundingPoints.topLeftX, boundingPoints.topRightY);
    ctx.stroke();
    ctx.closePath();
}

function getVideo() {
    navigator.mediaDevices.getUserMedia({ video: { width: 800, height: 600 }, audio: false })
        .then(localMediaStream => {
            //canvas(localMediaStream);
            video.srcObject = localMediaStream;
            video.play();
            landingScreen.style.display = 'none';
            cameraScreen.style.display = 'grid';
        })
        .catch(err => console.error(`OH NO!!`, err));
}

function paintToCanvas() {
    const width = video.videoWidth;
    const height = video.videoHeight;
    canvas.width = width;
    canvas.height = height;

    paintInterval = setInterval(() => {
        ctx.drawImage(video, 0, 0, width, height);
        const pixels = ctx.getImageData(0, 0, width, height);
        ctx.putImageData(pixels, 0, 0);
    }, 100);
}

async function takePhoto() {
    clearInterval(paintInterval);
    console.log('shutter clicked');
    const data = canvas.toDataURL('image/jpeg');
    let uuid = uuidv4();
    let blobName = `${uuid}.jpg`;
    const uploadResponse = await upload(dataURLToBlob(data), blobName);
    console.log(`uuid: ${uuid}`);
    const photoMetadata = await analyzeImage(uuid);
    console.log(photoMetadata);
    let smileScore = 0;
    photoMetadata.FaceData.map(face => {
        //If we see a smile on that face increment the smile score!
        if (face.faceAttributes.smile > 0.4) {
            drawRectangle(face.faceRectangle, `rgba(255,0,255,0.8)`, 4);
            smileScore++;
        }
    });
    let logoScore = 0;
    photoMetadata.LogoData.predictions.map(prediction => {
        if (prediction.probability > .80) {
            const translatedRectangle = {
                left: Math.round(canvas.width * prediction.boundingBox.left),
                top: Math.round(canvas.height * prediction.boundingBox.top),
                width: Math.round(canvas.width * prediction.boundingBox.width),
                height: Math.round(canvas.height * prediction.boundingBox.height),
            }
            drawRectangle(translatedRectangle, `rgba(255,255,0,0.8)`, 4);
            logoScore++;
        }
    });
    const smileDisplayScore = smileScore * 1000; // 'cause video games have to have scores in the thousands ;)
    const logoDisplayScore = logoScore * 1000;
    const totalScore = smileDisplayScore + logoDisplayScore;
    status.innerHTML = `Total Score: ${totalScore}`;
    const annotatedPhoto = canvas.toDataURL('image/jpeg');
    const link = document.createElement('a');
    link.href = annotatedPhoto;
    link.setAttribute('download', 'portrait.jpg');
    link.innerHTML = `<div class="snap"><img src="${annotatedPhoto}" alt="Portrait" /><div class="snap-caption">Score: ${totalScore}</div></div>`;
    strip.insertBefore(link, strip.firstChild);
    setTimeout(paintToCanvas, 2000);
    //canvas.style.display = 'none';
}

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/* Utility function to convert a canvas to a BLOB */
function dataURLToBlob(dataURL) {
    var BASE64_MARKER = ';base64,';
    if (dataURL.indexOf(BASE64_MARKER) == -1) {
        var parts = dataURL.split(',');
        var contentType = parts[0].split(':')[1];
        var raw = parts[1];

        return new Blob([raw], { type: contentType });
    }

    var parts = dataURL.split(BASE64_MARKER);
    var contentType = parts[0].split(':')[1];
    var raw = window.atob(parts[1]);
    var rawLength = raw.length;

    var uInt8Array = new Uint8Array(rawLength);

    for (var i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
    }

    return new Blob([uInt8Array], { type: contentType });
}

function blobToFile(theBlob, fileName) {
    //A Blob() is almost a File() - it's just missing the two properties below which we will add
    theBlob.lastModifiedDate = new Date();
    theBlob.name = fileName;
    return theBlob;
}

async function getSasUrlPromise(blobName, contentType) {
    let url = `https://mk-azure-upload.azurewebsites.net/api/azure-sas?code=5YOXZjWIeb5LC65c9WICbE3DNj6NfdhyfUABN0UXEAk9o/xAyYGJYg==`;
    return await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                container: 'photoboothai',
                blobName: blobName
            }),
            headers: {
                "Content-Type": contentType
            }
        })
        .then(
            response => response.json() // if the response is a JSON object
        ).catch(
            error => console.log(error) // Handle the error response object
        );
}

// This will upload the file after having read it
async function upload(imageBlob, blobName) {
    //Upload the image
    //showModal('Uploading and analyzing image...');
    const file = blobToFile(imageBlob, 'inputimage.jpg');
    const sasUriObj = await getSasUrlPromise(blobName);
    const sasUri = sasUriObj.uri;
    const mkAzureUpload = await fetch(sasUri, {
            method: 'PUT',
            body: file,
            headers: {
                "Content-Type": "image/jpeg",
                "x-ms-blob-type": "BlockBlob"
            }
        })
        .then(() => true)
        .catch(error => console.log(error));
};

//Calls Microsoft Face API and shows estimated ages of detected faces
async function analyzeImage(uuid) {
    const analyzeImageUrl = `${analyzeImageEndpoint}&uuid=${uuid}`;
    const response = await fetch(analyzeImageUrl);
    const data = await response.json();
    return data;
}

function textToSpeech(text) {
    /*var params = {
        OutputFormat: "mp3",
        SampleRate: "16000",
        Text: text,
        TextType: "text",
        VoiceId: "Nicole"
    };

    polly.synthesizeSpeech(params, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else {
            console.log(data); // successful response
            audioCtx.decodeAudioData(data.AudioStream.buffer, function(buffer) {
                sound = buffer;

                if (navigator.userAgent.match(/(iPod|iPhone|iPad)/i)) {
                    $("#speakbutton").show();
                }

                speak();
            });
        }
    });*/
}

function speak() {
    /*var source = audioCtx.createBufferSource();
    source.buffer = sound;
    source.connect(audioCtx.destination);
    source.start(0);*/
}

//textToSpeech('Welcome to Expression A I');