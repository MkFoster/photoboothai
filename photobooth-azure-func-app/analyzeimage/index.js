const axios = require('axios');
const azure = require('azure-storage');

// These are set in the Azure function application settings so we don't disclose
// them in the publicly available source code.
const faceApiEndpoint = process.env.FACE_API_ENDPOINT;
const faceApiKey = process.env.FACE_API_KEY;
const imageContainer = process.env.IMAGE_CONTAINER;
const mkUploadStorage = process.env.MK_UPLOAD_STORAGE;
const logoPredictionApiKey = process.env.MK_LOGO_PREDICTION_KEY;
const logoPredictionApiUrl = process.env.MK_LOGO_PREDICTION_URL;

/**
 * Generate an SAS URL to give to Face API to read our storage blob.
 * This Azure function will need to be granted rights to do this for the blob in question.
 * @param {} context 
 * @param {*} container 
 * @param {*} blobName 
 */
async function generateSasToken(context, container, blobName) {
    var blobService = azure.createBlobService(mkUploadStorage);

    // Create a SAS token that expires in an hour
    // Set start time to five minutes ago to avoid clock skew.
    var startDate = new Date();
    startDate.setMinutes(startDate.getMinutes() - 5);
    var expiryDate = new Date(startDate);
    expiryDate.setMinutes(startDate.getMinutes() + 60);

    //permissions = permissions || azure.BlobUtilities.SharedAccessPermissions.READ;

    // The following values can be used for permissions: 
    // "a" (Add), "r" (Read), "w" (Write), "d" (Delete), "l" (List)
    // Concatenate multiple permissions, such as "rwa" = Read, Write, Add

    var sharedAccessPolicy = {
        AccessPolicy: {
            Permissions: 'r',
            Start: startDate,
            Expiry: expiryDate
        }
    };

    var sasToken = blobService.generateSharedAccessSignature(container, blobName, sharedAccessPolicy);

    const output = {
        token: sasToken,
        uri: blobService.getUrl(container, blobName, sasToken, true)
    };
    console.log(output);
    return output;
}

module.exports = async function(context, req) {
    console.log(JSON.stringify(req, null, 4));

    if (req.query.uuid) {
        const blobName = `${req.query.uuid}.jpg`;

        //Get the face data from the Azure Face API
        const sasObj = await generateSasToken(context, imageContainer, blobName);
        const faceRequest = {
            method: 'post',
            url: `${faceApiEndpoint}/detect?returnFaceLandmarks=true&returnFaceAttributes=smile,emotion`,
            headers: {
                'Content-Type': 'application/json',
                'Ocp-Apim-Subscription-Key': faceApiKey
            },
            data: {
                url: sasObj.uri
            }
        };
        console.log(`Face Request: ${JSON.stringify(faceRequest, null, 4)}`)
        const faceResponse = await axios(faceRequest);
        console.log(`Face Data: ${JSON.stringify(faceResponse.data, null, 4)}`);

        //Get the logo prediction data via the custom vision API
        const logoRequest = {
            method: 'post',
            url: logoPredictionApiUrl,
            headers: {
                'Content-Type': 'application/json',
                'Prediction-Key': logoPredictionApiKey
            },
            data: {
                Url: sasObj.uri
            }
        };
        console.log(`Logo Request: ${JSON.stringify(logoRequest, null, 4)}`)
        const logoResponse = await axios(logoRequest);
        console.log(`Logo Data: ${JSON.stringify(logoResponse.data, null, 4)}`);

        //Build and return our response
        context.res = {
            // status: 200, /* Defaults to 200 */
            body: JSON.stringify({
                FaceData: faceResponse.data,
                LogoData: logoResponse.data
            })
        };
    } else {
        context.res = {
            status: 400,
            body: "Please pass a uuid on the query string"
        };
    }
};