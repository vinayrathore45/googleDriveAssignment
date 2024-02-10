const express = require('express');
const fs = require('fs');
const { google } = require('googleapis');
const dotenv = require('dotenv');
const path = require("path");

const app = express();

app.use(express.json());

dotenv.config({ path: path.resolve(__dirname,'./.env')});

const progress = {
  download: 0,
  upload: 0
};

const auth = new google.auth.GoogleAuth({
  keyFile: './serviceCredentials.json'/*JSON.parse(process.env.serviceCredentials)*/,
  scopes: 'https://www.googleapis.com/auth/drive',
});

const drive = google.drive({ version: 'v3', auth });


const downloadVideoFile = async (fileId) => {

  const { data: fileInfo } = await drive.files.get({
    fileId,
    fields: 'size'
  });
  const fileSize = parseInt(fileInfo.size);

  const destPath = './download.mp4';
  const destStream = fs.createWriteStream(destPath);

  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  const stream = res.data;
  let downloadedBytes = 0;
  stream
    .on('data', (chunk) => {
      downloadedBytes += chunk.length;
      const downloadProgress = Math.round((downloadedBytes / fileSize) * 100);
      progress.download = downloadProgress;
    })
    .on('end', () => console.log('Download complete'))
    .on('error', err => console.error('Download error', err))
    .pipe(destStream);

  await new Promise((resolve, reject) => {
    destStream.on('finish', () => resolve(destPath));
    destStream.on('error', err => reject(err));
  });

  return destPath;
}

const uploadVideoFile  = async (filePath, folderId) => {
  const fileSize = fs.statSync(filePath).size;
  const fileMetadata = {
    name: 'uploaded_video.mp4',
    parents: [folderId],
  };

  const media = {
    mimeType: 'video/mp4',
    body: fs.createReadStream(filePath),
  };

  let uploadProgress;
  const res = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id',
  },
   { onUploadProgress: (evt) => {
      uploadProgress = Math.round((evt.bytesRead / fileSize) * 100);   /*.bytesUploaded*/
      progress.upload = uploadProgress;
    }}
  );

  console.log('File uploaded with ID:', res.data.id);
  return res.data.id;
}

app.post('/videoTransfer', async (req, res) => {
  
  try {
    const { fileId, destinationFolderId } = req.body;
    if(!fileId || typeof(fileId)!= 'string') 
      return res.status(400).send({msg: "Please Provide File Id"});

      if(!destinationFolderId || typeof(destinationFolderId)!= 'string') 
        return res.status(400).send({msg: "Please Provide  Folder Id"});
    

      progress.download = 0;
      progress.upload = 0;    


    const downloadedFilePath = await downloadVideoFile(fileId);

    progress.download = 100;

    const uploadedFileId = await uploadVideoFile(downloadedFilePath, destinationFolderId);
    progress.upload = 100;    

    res.status(200).send({msg: 'Transfer completed successfully.', uploadedFileId});
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).send({msg:'Transfer failed.', error: error.message});
  }
});

app.get('/monitorProgress', (req, res) => {
  res.json(progress);
});

app.use(express.static('./frontend'));

app.get('/', (req, res) => {
    // Serve the HTML file using res.sendFile
    res.sendFile('./frontend/app.html');
  });
// Start the server
app.listen(80, () => {
  console.log('Server is running on port ' + 80);
});
