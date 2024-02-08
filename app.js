const express = require('express');
const fs = require('fs');
const { google } = require('googleapis');
const { Readable } = require('stream');

const app = express();

const auth = new google.auth.GoogleAuth({
  keyFile: 'path_to_your_credentials.json',
  scopes: 'https://www.googleapis.com/auth/drive',
});

const drive = google.drive({ version: 'v3', auth });


async function downloadVideoFile(fileId) {
  const destPath = 'path_to_save_downloaded_video.mp4';
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

async function uploadVideoFile(filePath, folderId) {
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
}

app.get('/videoTransfer', async (req, res) => {
  const fileId = 'your_video_file_id';
 // const sourceFolderId = 'your_source_folder_id';
  const destinationFolderId = 'your_destination_folder_id';

  try {
    const downloadedFilePath = await downloadVideoFile(fileId);

    await uploadVideoFile(downloadedFilePath, destinationFolderId);

    res.status(200).send('Transfer completed successfully.');
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).send({msg:'Transfer failed.', error});
  }
});

// Start the server
app.listen(80, () => {
  console.log('Server is running on port ' + 80);
});
