const express = require('express');
const fs = require('fs');
const { google } = require('googleapis');

const app = express();

app.use(express.json());

const auth = new google.auth.GoogleAuth({
  keyFile: './googleDriveAssignment/serviceCredentials.json',
  scopes: 'https://www.googleapis.com/auth/drive',
});

const drive = google.drive({ version: 'v3', auth });


const downloadVideoFile = async (fileId) => {
  const destPath = './download.mp4';
  const destStream = fs.createWriteStream(destPath);

  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  
  res.data
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
  const fileMetadata = {
    name: 'uploaded_video.mp4',
    parents: [folderId],
  };

  const media = {
    mimeType: 'video/mp4',
    body: fs.createReadStream(filePath),
  };

  const res = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id',
  });

  console.log('File uploaded with ID:', res.data.id);
  return res.data.id;
}

app.post('/videoTransfer', async (req, res) => {
  
  try {
    const { fileId, destinationFolderId } = req.body;
    if(!fileId || typeof(fileId)!= 'string') 
      return res.status(400).send({msg: "Please Provide  source video file Id and it must be a string"});

      if(!destinationFolderId || typeof(destinationFolderId)!= 'string') 
        return res.status(400).send({msg: "Please Provide  destination folder Id and it must be a string"});



    const downloadedFilePath = await downloadVideoFile(fileId);

    const uploadedFileId = await uploadVideoFile(downloadedFilePath, destinationFolderId);

    res.status(200).send({msg: 'Transfer completed successfully.', uploadedFileId});
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).send({msg:'Transfer failed.', error: error.message});
  }
});

// Start the server
app.listen(80, () => {
  console.log('Server is running on port ' + 80);
});
